import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';
import { NansenError, NansenService } from '../nansen/nansen.service.js';
import { calcWeight, normalizeWeights, TokenWeight } from './index.analytics.js';

export type IndexStatus = 'ok' | 'nansen-empty' | 'nansen-error' | 'fallback';

export interface IndexState {
  indexName: string;
  lastUpdate: string;
  tokens: TokenWeight[];
  apiCalls: number;
  status: IndexStatus;
  message: string | null;
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

  constructor(
    private readonly nansen: NansenService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfigShape,
  ) {
    this.ttl = this.cfg.cache.ttlSeconds * 1000;
  }

  async current(): Promise<IndexState> {
    if (this.cache && Date.now() - this.cache.at < this.ttl) return this.cache.data;

    let tokens: TokenWeight[];
    let status: IndexStatus = 'ok';
    let message: string | null = null;

    try {
      const flow: any = await this.nansen.getSmartMoneyFlow();
      const raw: any[] = flow?.tokens ?? flow?.data ?? [];
      if (raw.length === 0) {
        status = 'nansen-empty';
        message = this.cfg.index.messages.nansenEmpty;
        tokens = this.fallbackTokens();
      } else {
        tokens = raw.map((t: any) => ({
          symbol: t.symbol ?? t.token_symbol ?? 'UNKNOWN',
          weight: 0,
          smartMoneyScore: Number(t.smart_money_score ?? 50),
          correlation: Number(t.correlation ?? 0.85),
          whaleConcentration: Number(t.whale_concentration ?? 20),
        }));
      }
    } catch (err) {
      status = err instanceof NansenError ? 'fallback' : 'nansen-error';
      message = this.cfg.index.messages.nansenError;
      tokens = this.fallbackTokens();
    }

    const weighted = normalizeWeights(
      tokens.map((t) => ({ ...t, weight: calcWeight(t, this.cfg.index.scoring) })),
    ).sort((a, b) => b.weight - a.weight);

    this.updatePreviousWeights(weighted);

    const data: IndexState = {
      indexName: this.cfg.index.name,
      lastUpdate: new Date().toISOString(),
      tokens: weighted,
      apiCalls: this.nansen.getCallCount(),
      status,
      message,
    };
    this.cache = { data, at: Date.now() };
    return data;
  }

  private fallbackTokens(): TokenWeight[] {
    return this.cfg.index.fallbackTokens.map((t) => ({
      symbol: t.symbol,
      weight: 0,
      smartMoneyScore: t.smartMoneyScore,
      correlation: t.correlation,
      whaleConcentration: t.whaleConcentration,
    }));
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
    const { tokens } = await this.current();
    const topN = this.cfg.index.topN;
    const targetUniverse = tokens.slice(0, topN);
    const r = this.cfg.index.rebalance;

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
