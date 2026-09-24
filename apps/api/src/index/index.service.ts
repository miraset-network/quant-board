import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';
import {
  CreditSnapshot,
  NansenService,
  SmartMoneyNetflowRow,
} from '../nansen/nansen.service.js';
import { calcWeight, clamp01, normalizeWeights, TokenWeight } from './index.analytics.js';

export type IndexStatus = 'ok' | 'nansen-empty' | 'nansen-error';

export interface IndexState {
  indexName: string;
  lastUpdate: string;
  tokens: TokenWeight[];
  apiCalls: number;
  successfulCalls: number;
  status: IndexStatus;
  message: string | null;
  source: 'nansen';
  nansenRows?: SmartMoneyNetflowRow[];
  credits: CreditSnapshot & { totalRemaining: number | null };
}

interface CacheEntry {
  data: IndexState;
  at: number;
}

@Injectable()
export class IndexService {
  private cache: CacheEntry | null = null;
  private previousWeights: Record<string, number> = {};
  private readonly ttl: number;
  private readonly scoreScaleUsd: number;
  private readonly traderScale: number;
  private readonly marketCapScaleUsd: number;

  constructor(
    private readonly nansen: NansenService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfigShape,
  ) {
    this.ttl = this.cfg.cache.ttlSeconds * 1000;
    this.scoreScaleUsd = this.cfg.index.scoring.scoreScaleUsd;
    this.traderScale = this.cfg.index.scoring.traderCountScale;
    this.marketCapScaleUsd = this.cfg.index.scoring.marketCapScaleUsd;
  }

  async current(): Promise<IndexState> {
    if (this.cache && Date.now() - this.cache.at < this.ttl) return this.cache.data;

    if (this.shouldRefreshCredits()) {
      try {
        await this.nansen.getAccount();
      } catch {
        /* keep previous snapshot */
      }
    }

    let tokens: TokenWeight[];
    let status: IndexStatus = 'ok';
    let message: string | null = null;
    let nansenRows: SmartMoneyNetflowRow[] | undefined;

    try {
      const res = await this.nansen.getSmartMoneyNetflow();
      const raw = res.data ?? [];
      if (raw.length === 0) {
        status = 'nansen-empty';
        message = this.cfg.index.messages.nansenEmpty;
        tokens = [];
      } else {
        nansenRows = raw;
        tokens = raw.map((r) => this.netflowRowToToken(r));
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error';
      status = 'nansen-error';
      message = `${this.cfg.index.messages.nansenError}: ${detail}`;
      tokens = [];
    }


    const weighted = tokens.length === 0
      ? []
      : normalizeWeights(
          tokens.map((t) => ({ ...t, weight: calcWeight(t, this.cfg.index.scoring) })),
        ).sort((a, b) => b.weight - a.weight);

    if (weighted.length > 0) this.updatePreviousWeights(weighted);

    const data: IndexState = {
      indexName: this.cfg.index.name,
      lastUpdate: new Date().toISOString(),
      tokens: weighted,
      apiCalls: this.nansen.getCallCount(),
      successfulCalls: this.nansen.getSuccessCount(),
      status,
      message,
      source: 'nansen',
      nansenRows,
      credits: this.buildCredits(),
    };
    this.cache = { data, at: Date.now() };
    return data;
  }

  private netflowRowToToken(r: SmartMoneyNetflowRow): TokenWeight {
    const flow = Number(r.net_flow_24h_usd ?? 0);
    const flowSign = flow >= 0 ? 1 : -1;
    const flowMag = Math.abs(flow);
    const flowScore = clamp01(flowMag / this.scoreScaleUsd) * flowSign;

    const traderScore = clamp01(Number(r.trader_count ?? 0) / this.traderScale);
    const marketCapScore = clamp01(Number(r.market_cap_usd ?? 0) / this.marketCapScaleUsd);

    const smartMoneyScore = Number(((flowScore + 1) * 50).toFixed(2));
    const correlation = Number((traderScore * 0.5 + marketCapScore * 0.5).toFixed(3));
    const whaleConcentration = Number((traderScore * 100).toFixed(2));

    return {
      symbol: r.token_symbol || 'UNKNOWN',
      weight: 0,
      smartMoneyScore,
      correlation,
      whaleConcentration,
    };
  }

  private shouldRefreshCredits(): boolean {
    const c = this.nansen.getCredits();
    if (c.includedRemaining === null && c.purchasedRemaining === null && c.plan === null) {
      return true;
    }
    const ageMs = Date.now() - new Date(c.updatedAt).getTime();
    return ageMs > 60_000;
  }

  private buildCredits() {
    const c = this.nansen.getCredits();
    const totalRemaining =
      (c.includedRemaining ?? 0) + (c.purchasedRemaining ?? 0);
    return {
      ...c,
      totalRemaining:
        c.includedRemaining !== null || c.purchasedRemaining !== null
          ? totalRemaining
          : null,
    };
  }

  private updatePreviousWeights(weighted: TokenWeight[]): void {
    const top = weighted.slice(0, this.cfg.index.topN);
    if (Object.keys(this.previousWeights).length === 0) {
      const base = 100 / top.length;
      const drifted = top.map((t, i) => {
        const tilt = ((i % 3) - 1) * this.cfg.index.rebalance.initialTiltPct;
        return { ...t, weight: Math.max(this.cfg.index.rebalance.minWeightPct, base + tilt) };
      });
      const sum = drifted.reduce((acc, t) => acc + t.weight, 0);
      this.previousWeights = Object.fromEntries(
        drifted.map((t) => [t.symbol, Number(((t.weight / sum) * 100).toFixed(2))]),
      );
    } else {
      this.previousWeights = Object.fromEntries(
        top.map((t) => [t.symbol, Number(t.weight.toFixed(2))]),
      );
    }
  }

  async rebalance() {
    const idx = await this.current();
    const targetUniverse = idx.tokens.slice(0, this.cfg.index.topN);
    const r = this.cfg.index.rebalance;

    if (targetUniverse.length === 0) {
      return {
        signalDate: new Date().toISOString(),
        triggered: false,
        drift: 0,
        confidence: 0,
        actions: [],
        indexStatus: idx.status,
        message: idx.message,
      };
    }

    const symbols = targetUniverse.map((t) => t.symbol);
    const currentMap: Record<string, number> = {};
    for (const s of symbols) {
      currentMap[s] = this.previousWeights[s] ?? Number((100 / symbols.length).toFixed(2));
    }
    const currentSum = Object.values(currentMap).reduce((a, b) => a + b, 0);
    for (const s of symbols) {
      currentMap[s] = Number(((currentMap[s] / currentSum) * 100).toFixed(2));
    }

    const targetMap: Record<string, number> = {};
    targetUniverse.forEach((t, i) => {
      const cap = 100 / targetUniverse.length;
      const tilt = ((i % 3) - 1) * r.targetTiltPct;
      targetMap[t.symbol] = Math.max(r.minWeightPct, cap + tilt);
    });
    const targetSum = Object.values(targetMap).reduce((a, b) => a + b, 0);
    for (const s of symbols) {
      targetMap[s] = Number(((targetMap[s] / targetSum) * 100).toFixed(2));
    }

    const actions = symbols.map((s) => {
      const diff = Number((targetMap[s] - currentMap[s]).toFixed(2));
      const action = Math.abs(diff) < r.holdThresholdPct ? 'HOLD' : diff > 0 ? 'BUY' : 'SELL';
      return {
        action,
        token: s,
        change: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
      };
    });

    const drift = Math.max(
      ...symbols.map((s) => Number(Math.abs(targetMap[s] - currentMap[s]).toFixed(2))),
    );

    return {
      signalDate: new Date().toISOString(),
      triggered: drift / 100 > this.cfg.thresholds.rebalance,
      drift,
      confidence: Number(
        Math.min(r.confidenceCap, r.confidenceBase + (drift / 100) * r.confidenceDriftFactor * 10).toFixed(2),
      ),
      actions,
    };
  }
}
