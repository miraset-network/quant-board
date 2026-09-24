import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';
import { NansenService, OhlcvCandle } from '../nansen/nansen.service.js';
import { IndexService } from '../index/index.service.js';
import {
  buildLogSpread,
  halfLifeOfMeanReversion,
  pearson,
  toLogPrices,
  type SpreadStats,
} from '../index/index.analytics.js';

export interface HedgeNotionals {
  legA: number;
  legB: number;
}

export interface ArbitrageOpportunity {
  pair: string;
  correlation: number;
  divergence: number;
  signal: string;
  expectedReturn: string;
  candlesUsed: number;
  beta: number;
  zScore: number;
  halfLifeDays: number;
  halfLifeOk: boolean;
  spreadMean: number;
  spreadStd: number;
  notionalRatio: string;
  hedgeNotionals: HedgeNotionals;
  exitTarget: number;
}

@Injectable()
export class ArbitrageService {
  private readonly logger = new Logger(ArbitrageService.name);
  private readonly corrThreshold: number;
  private readonly divThreshold: number;
  private readonly topN: number;
  private readonly minCandles: number;
  private readonly lookbackDays: number;
  private readonly ttl: number;
  private readonly statArb: AppConfigShape['arbitrage']['statArb'];
  private cache: { data: any; at: number } | null = null;

  constructor(
    private readonly index: IndexService,
    private readonly nansen: NansenService,
    @Inject(APP_CONFIG) cfg: AppConfigShape,
  ) {
    this.corrThreshold = cfg.thresholds.arbCorr;
    this.divThreshold = cfg.thresholds.arbDiv;
    this.topN = cfg.arbitrage.topN;
    this.minCandles = cfg.arbitrage.minCandles;
    this.lookbackDays = cfg.nansen.defaults.ohlcvLookbackDays;
    this.ttl = cfg.cache.ttlSeconds * 1000;
    this.statArb = cfg.arbitrage.statArb;
  }

  async opportunities() {
    if (this.cache && Date.now() - this.cache.at < this.ttl) return this.cache.data;
    const data = await this.computeOpportunities();
    this.cache = { data, at: Date.now() };
    return data;
  }

  private selectWindow(closesA: number[], closesB: number[]): number {
    const max = Math.min(closesA.length, closesB.length);
    const upper = Math.min(this.statArb.maxWindow, max);
    const lower = Math.min(this.statArb.minWindow, upper);
    return Math.max(lower, upper);
  }

  private computeOpportunities() {
    return this.index.current().then(async (idx) => {
      const top = idx.tokens.slice(0, this.topN);

      if (idx.status !== 'ok') {
        return {
          opportunities: [],
          status: idx.status as 'nansen-empty' | 'nansen-error',
          message: idx.message ?? 'Index unavailable',
        };
      }
      if (top.length === 0) {
        return {
          opportunities: [],
          status: 'no-threshold-match' as const,
          message: 'Index returned no tokens',
        };
      }

      const addrBySymbol = new Map<string, { address: string; chain: string }>();
      for (const row of idx.nansenRows ?? []) {
        if (!addrBySymbol.has(row.token_symbol)) {
          addrBySymbol.set(row.token_symbol, { address: row.token_address, chain: row.chain });
        }
      }

      const requested: { symbol: string; address: string; chain: string }[] = [];
      for (const t of top) {
        const info = addrBySymbol.get(t.symbol);
        if (info) requested.push({ symbol: t.symbol, address: info.address, chain: info.chain });
      }
      if (requested.length < 2) {
        return {
          opportunities: [],
          status: 'no-threshold-match' as const,
          message: 'Need at least 2 token addresses — try expanding the index',
        };
      }

      const lookback = this.lookbackDays;
      const to = new Date();
      const from = new Date(to.getTime() - lookback * 24 * 60 * 60 * 1000);
      const fromIso = from.toISOString().slice(0, 10);
      const toIso = to.toISOString().slice(0, 10);

      const byChain = new Map<string, typeof requested>();
      for (const r of requested) {
        if (!byChain.has(r.chain)) byChain.set(r.chain, []);
        byChain.get(r.chain)!.push(r);
      }

      const candlesByAddr = new Map<string, OhlcvCandle[]>();
      const errors: { chain: string; message: string }[] = [];
      for (const [chain, group] of byChain) {
        try {
          const ohlcv = await this.nansen.getOhlcvBatch({
            chain,
            tokenAddresses: group.map((r) => r.address),
            from: fromIso,
            to: toIso,
          });
          for (const t of ohlcv.tokens ?? []) {
            candlesByAddr.set(t.token_address, t.data ?? []);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown error';
          this.logger.warn(`OHLCV fetch failed for ${chain}: ${msg}`);
          errors.push({ chain, message: msg });
        }
      }

      if (candlesByAddr.size === 0 && errors.length > 0) {
        const first = errors[0];
        const allSame = errors.every((e) => e.message === first.message);
        return {
          opportunities: [],
          status: 'nansen-error' as const,
          message: allSame
            ? `OHLCV unavailable (${first.chain}): ${first.message}`
            : `OHLCV unavailable: ${errors.map((e) => `${e.chain} — ${e.message}`).join('; ')}`,
        };
      }

      const closesBySymbol = new Map<string, number[]>();
      const symByAddr = new Map<string, string>();
      for (const r of requested) symByAddr.set(r.address, r.symbol);
      for (const r of requested) {
        const c = candlesByAddr.get(r.address) ?? [];
        const closes = c
          .filter((x) => typeof x.close === 'number' && Number.isFinite(x.close) && x.close > 0)
          .map((x) => x.close);
        if (closes.length >= this.minCandles) closesBySymbol.set(r.symbol, closes);
      }

      if (closesBySymbol.size < 2) {
        return {
          opportunities: [],
          status: 'no-threshold-match' as const,
          message: `Need ≥2 tokens with ≥${this.minCandles} OHLCV candles — got ${closesBySymbol.size}`,
        };
      }

      const symbols = [...closesBySymbol.keys()];
      const out: ArbitrageOpportunity[] = [];
      for (let i = 0; i < symbols.length; i++) {
        for (let j = i + 1; j < symbols.length; j++) {
          const a = symbols[i];
          const b = symbols[j];
          const ca = closesBySymbol.get(a)!;
          const cb = closesBySymbol.get(b)!;
          const opp = this.evaluatePair(a, b, ca, cb);
          if (opp) out.push(opp);
        }
      }
      out.sort((x, y) => Math.abs(y.zScore) - Math.abs(x.zScore));

      return {
        opportunities: out,
        status: out.length > 0 ? ('ok' as const) : ('no-threshold-match' as const),
        message: out.length > 0
          ? null
          : `no pairs cleared z≥${this.statArb.zEntryThreshold} & |halfLife|≤${this.statArb.maxHalfLifeDays}d`,
        apiCalls: this.nansen.getCallCount(),
        successfulCalls: this.nansen.getSuccessCount(),
      };
    });
  }

  private evaluatePair(
    a: string,
    b: string,
    closesA: number[],
    closesB: number[],
  ): ArbitrageOpportunity | null {
    const window = this.selectWindow(closesA, closesB);
    if (window < this.statArb.minWindow) return null;

    const tailA = closesA.slice(closesA.length - window);
    const tailB = closesB.slice(closesB.length - window);

    const corr = pearson(tailA, tailB);
    if (corr < this.statArb.minCorrForCointegration) return null;

    const logA = toLogPrices(tailA);
    const logB = toLogPrices(tailB);
    const spread: SpreadStats | null = buildLogSpread(logA, logB);
    if (!spread) return null;

    const halfLife = halfLifeOfMeanReversion(spread.spread.slice(0, -1));
    const halfLifeOk = Number.isFinite(halfLife) && halfLife > 0 && halfLife <= this.statArb.maxHalfLifeDays;

    const absZ = Math.abs(spread.zScore);
    if (absZ < this.statArb.zEntryThreshold) return null;

    const absDiv = absZ * spread.std;
    if (absDiv < this.divThreshold) return null;

    const [legLong, legShort] = spread.zScore > 0 ? [b, a] : [a, b];
    const signal = `LONG_${legLong}_SHORT_${legShort}`;
    const betaAbs = Math.abs(spread.beta);

    const hedgeNotionals: HedgeNotionals = betaAbs > 0
      ? { legA: 1, legB: Number(betaAbs.toFixed(3)) }
      : { legA: 1, legB: 0 };

    return {
      pair: `${a}/${b}`,
      correlation: Number(corr.toFixed(3)),
      divergence: Number((absDiv * 100).toFixed(2)),
      signal,
      expectedReturn: `${(absDiv * 100).toFixed(2)}%`,
      candlesUsed: spread.candlesUsed,
      beta: Number(spread.beta.toFixed(3)),
      zScore: Number(spread.zScore.toFixed(2)),
      halfLifeDays: Number.isFinite(halfLife) ? Number(halfLife.toFixed(2)) : -1,
      halfLifeOk,
      spreadMean: Number(spread.mean.toFixed(4)),
      spreadStd: Number(spread.std.toFixed(4)),
      notionalRatio: betaAbs > 0 ? `1 : ${betaAbs.toFixed(3)}` : '1 : 0',
      hedgeNotionals,
      exitTarget: this.statArb.zExitThreshold,
    };
  }
}
