import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type IndexState as SharedIndexState,
  type RebalanceSignal as SharedRebalanceSignal,
} from '@quant-board/shared';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';
import { CacheService } from '../cache/cache.service.js';
import { DatabaseService } from '../database/database.service.js';
import {
  NansenService,
  OhlcvCandle,
  SmartMoneyNetflowRow,
  TgmIndicator,
  TgmIndicatorsResponse,
} from '../nansen/nansen.service.js';
import { calcWeight, clamp01, normalizeWeights, pearson, TokenWeight } from './index.analytics.js';

export type IndexStatus = 'ok' | 'nansen-empty' | 'nansen-error';

export interface IndexState extends SharedIndexState {
  nansenRows?: SmartMoneyNetflowRow[];
}

export interface RebalanceSignal extends SharedRebalanceSignal {}

interface CacheEntry {
  data: IndexState;
  at: number;
}

@Injectable()
export class IndexService {
  private readonly logger = new Logger(IndexService.name);
  private cache: CacheEntry | null = null;
  private previousWeights: Record<string, number> = {};
  private readonly ttl: number;
  private readonly scoreScaleUsd: number;
  private readonly traderScale: number;
  private readonly marketCapScaleUsd: number;

  constructor(
    private readonly nansen: NansenService,
    private readonly cacheStore: CacheService,
    private readonly db: DatabaseService,
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

    // Fetch OHLCV and compute real Pearson correlation matrix for top tokens
    if (weighted.length > 1 && status === 'ok') {
      await this.enrichWithRealCorrelation(weighted);
      // Re-normalize weights after real correlation update
      const reWeighted = normalizeWeights(
        weighted.map((t) => ({ ...t, weight: calcWeight(t, this.cfg.index.scoring) })),
      ).sort((a, b) => b.weight - a.weight);
      weighted.length = 0;
      weighted.push(...reWeighted);
    }

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

    // Persist snapshot to PostgreSQL (fire-and-forget)
    void this.db.saveIndexSnapshot({
      indexName: data.indexName,
      lastUpdate: data.lastUpdate,
      tokens: data.tokens,
      status: data.status,
    });

    return data;
  }

  private async enrichWithRealCorrelation(tokens: TokenWeight[]): Promise<void> {
    const top = tokens.slice(0, this.cfg.index.topN);
    const byChain = new Map<string, string[]>();
    for (const t of top) {
      if (!t.chain || !t.tokenAddress) continue;
      const list = byChain.get(t.chain) ?? [];
      list.push(t.tokenAddress);
      byChain.set(t.chain, list);
    }

    const closesBySymbol = new Map<string, number[]>();
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromIso = from.toISOString().slice(0, 10);
    const toIso = to.toISOString().slice(0, 10);

    for (const [chain, addresses] of byChain) {
      try {
        const resp = await this.nansen.getOhlcvBatch({
          chain,
          tokenAddresses: addresses,
          from: fromIso,
          to: toIso,
        });
        for (const tokenData of resp.tokens ?? []) {
          const match = top.find(
            (t) =>
              t.tokenAddress?.toLowerCase() === tokenData.token_address.toLowerCase() &&
              t.chain?.toLowerCase() === chain.toLowerCase(),
          );
          if (!match) continue;
          const closes = tokenData.data
            .filter((c) => typeof c.close === 'number' && c.close > 0)
            .map((c) => c.close);
          if (closes.length >= 7) {
            closesBySymbol.set(match.symbol, closes);
          }
        }
      } catch {
        this.logger.warn(`OHLCV fetch failed for chain ${chain}, keeping proxy correlation`);
      }
    }

    // Compute average |correlation| of each token vs all others
    const symbols = [...closesBySymbol.keys()];
    if (symbols.length < 2) return;

    for (const token of tokens) {
      const closesA = closesBySymbol.get(token.symbol);
      if (!closesA) continue;
      let sumCorr = 0;
      let count = 0;
      for (const other of symbols) {
        if (other === token.symbol) continue;
        const closesB = closesBySymbol.get(other);
        if (!closesB) continue;
        const len = Math.min(closesA.length, closesB.length);
        if (len < 7) continue;
        const corr = pearson(closesA.slice(-len), closesB.slice(-len));
        if (Number.isFinite(corr)) {
          sumCorr += Math.abs(corr);
          count++;
        }
      }
      if (count > 0) {
        // Store 1 - avg|corr| so that low correlation = high score (diversification bonus)
        token.correlation = Number((1 - sumCorr / count).toFixed(3));
      }
    }
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
      tokenAddress: r.token_address,
      chain: r.chain,
      marketCapUsd: Number(r.market_cap_usd ?? 0),
      netflow24hUsd: Number(r.net_flow_24h_usd ?? 0),
      netflow7dUsd: Number(r.net_flow_7d_usd ?? 0),
      netflow30dUsd: Number(r.net_flow_30d_usd ?? 0),
      traderCount: Number(r.trader_count ?? 0),
      tokenAgeDays: Number(r.token_age_days ?? 0),
      sectors: r.token_sectors ?? [],
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
      actions: actions.map((a) => ({ ...a, action: a.action as 'BUY' | 'SELL' | 'HOLD' })),
    };
  }

  async tokenDetails(chain: string, address: string, days = 30) {
    const safeDays = Math.max(7, Math.min(90, Number.isFinite(days) ? Math.floor(days) : 30));
    const idx = await this.current();
    const match = idx.tokens.find(
      (t) =>
        (t.chain ?? '').toLowerCase() === chain.toLowerCase() &&
        (t.tokenAddress ?? '').toLowerCase() === address.toLowerCase(),
    );

    const to = new Date();
    const from = new Date(to.getTime() - safeDays * 24 * 60 * 60 * 1000);
    const fromIso = from.toISOString().slice(0, 10);
    const toIso = to.toISOString().slice(0, 10);

    let candles: OhlcvCandle[] = [];
    let ohlcvError: string | null = null;
    try {
      const resp = await this.nansen.getOhlcvBatch({
        chain,
        tokenAddresses: [address],
        from: fromIso,
        to: toIso,
      });
      candles = resp.tokens?.[0]?.data ?? [];
    } catch (err) {
      ohlcvError = err instanceof Error ? err.message : 'unknown error';
    }

    const series = candles.map((c) => ({
      date: c.interval_start.slice(0, 10),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volumeUsd: c.volume_usd,
    }));

    const last = series.length > 0 ? series[series.length - 1] : null;
    const first = series.length > 0 ? series[0] : null;
    const changePct =
      last && first && typeof last.close === 'number' && first.close
        ? Number((((last.close - first.close) / first.close) * 100).toFixed(2))
        : null;

    return {
      chain,
      address,
      days: safeDays,
      windowStart: fromIso,
      windowEnd: toIso,
      symbol: match?.symbol ?? null,
      weight: match?.weight ?? null,
      smartMoneyScore: match?.smartMoneyScore ?? null,
      correlation: match?.correlation ?? null,
      whaleConcentration: match?.whaleConcentration ?? null,
      marketCapUsd: match?.marketCapUsd ?? null,
      netflow24hUsd: match?.netflow24hUsd ?? null,
      netflow7dUsd: match?.netflow7dUsd ?? null,
      netflow30dUsd: match?.netflow30dUsd ?? null,
      traderCount: match?.traderCount ?? null,
      tokenAgeDays: match?.tokenAgeDays ?? null,
      sectors: match?.sectors ?? [],
      price: last?.close ?? null,
      changePct,
      series,
      ohlcvError,
      generatedAt: new Date().toISOString(),
    };
  }

  async tokenRisk(chain: string, address: string) {
    const cacheKey = `tgm:indicators:${chain.toLowerCase()}:${address.toLowerCase()}`;
    const cached = await this.cacheStore.get<TgmIndicatorsResponse>(cacheKey);
    if (cached) {
      return { ...this.shapeRisk(chain, address, cached), cached: true };
    }

    const credits = this.buildCredits();
    const minRequired = this.cfg.indicators.minCreditsForRisk;
    if (credits.totalRemaining !== null && credits.totalRemaining < minRequired) {
      return {
        chain,
        address,
        skipped: true,
        reason: `credits low (${credits.totalRemaining} < ${minRequired}), skipping indicators call`,
        cached: false,
        riskIndicators: null,
        rewardIndicators: null,
        tokenInfo: null,
      };
    }

    try {
      const resp = await this.nansen.getTokenIndicators(chain, address);
      await this.cacheStore.set(cacheKey, resp, this.cfg.indicators.riskCacheTtlSeconds);
      return { ...this.shapeRisk(chain, address, resp), cached: false };
    } catch (err) {
      return {
        chain,
        address,
        skipped: false,
        cached: false,
        error: err instanceof Error ? err.message : 'unknown error',
        riskIndicators: null,
        rewardIndicators: null,
        tokenInfo: null,
      };
    }
  }

  private shapeRisk(chain: string, address: string, resp: TgmIndicatorsResponse) {
    const fmtIndicator = (i: TgmIndicator) => ({
      type: i.indicator_type,
      score: i.score ?? null,
      signal: i.signal ?? null,
      percentile: i.signal_percentile ?? null,
      lastTriggerOn: i.last_trigger_on ?? null,
    });
    return {
      chain,
      address,
      skipped: false,
      cached: false,
      tokenInfo: resp.token_info ?? null,
      riskIndicators: (resp.risk_indicators ?? []).map(fmtIndicator),
      rewardIndicators: (resp.reward_indicators ?? []).map(fmtIndicator),
      generatedAt: new Date().toISOString(),
    };
  }
}
