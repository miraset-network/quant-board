import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';
import { IndexService } from '../index/index.service.js';
import { NansenService, OhlcvCandle } from '../nansen/nansen.service.js';

export type BacktestStatus = 'ok' | 'no-data' | 'nansen-error';

export interface BacktestPoint {
  date: string;
  nav: number;
}

export interface BacktestLeg {
  symbol: string;
  weight: number;
  returnPct: number;
  candles: number;
}

export interface BacktestResult {
  status: BacktestStatus;
  message: string | null;
  days: number;
  windowStart: string;
  windowEnd: string;
  universeSize: number;
  requestedSize: number;
  startNav: number;
  endNav: number;
  returnPct: number;
  maxDrawdownPct: number;
  bestDay: { date: string; pct: number } | null;
  worstDay: { date: string; pct: number } | null;
  series: BacktestPoint[];
  legs: BacktestLeg[];
  generatedAt: string;
}

interface CacheEntry {
  key: string;
  data: BacktestResult;
  at: number;
}

interface LegPayload {
  closes: number[];
  weight: number;
  symbol: string;
}

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);
  private cache: CacheEntry | null = null;

  constructor(
    private readonly indexService: IndexService,
    private readonly nansen: NansenService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfigShape,
  ) {}

  async run(days: number): Promise<BacktestResult> {
    const safeDays = this.clampDays(days);
    const idx = await this.indexService.current();
    const universe = idx.tokens.slice(0, this.cfg.index.topN).filter((t) => t.weight > 0);
    const universeKey = universe
      .slice()
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .map((t) => `${t.symbol}:${t.weight.toFixed(2)}`)
      .join('|');
    const key = `${safeDays}::${universeKey}`;
    const now = Date.now();
    if (this.cache && this.cache.key === key && now - this.cache.at < this.cfg.cache.ttlSeconds * 1000) {
      return this.cache.data;
    }

    if (universe.length === 0 || !idx.nansenRows || idx.nansenRows.length === 0) {
      const empty = this.emptyResult(safeDays, idx.message ?? 'index universe is empty — cannot backtest', 0, 0);
      this.cache = { key, data: empty, at: now };
      return empty;
    }

    const addrBySymbol = new Map<string, { address: string; chain: string }>();
    for (const row of idx.nansenRows) {
      if (!row.token_symbol || !row.token_address || !row.chain) continue;
      if (!addrBySymbol.has(row.token_symbol)) {
        addrBySymbol.set(row.token_symbol, { address: row.token_address, chain: row.chain });
      }
    }

    const to = new Date();
    const from = new Date(to.getTime() - safeDays * 24 * 60 * 60 * 1000);
    const fromIso = from.toISOString().slice(0, 10);
    const toIso = to.toISOString().slice(0, 10);

    const requested = universe
      .map((t) => {
        const ref = addrBySymbol.get(t.symbol);
        return ref ? { symbol: t.symbol, weight: t.weight, address: ref.address, chain: ref.chain } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (requested.length === 0) {
      const empty = this.emptyResult(safeDays, 'no token addresses resolvable from index snapshot', 0, 0, fromIso, toIso);
      this.cache = { key, data: empty, at: now };
      return empty;
    }

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
        this.logger.warn(`backtest OHLCV fetch failed for ${chain}: ${msg}`);
        errors.push({ chain, message: msg });
      }
    }

    const payloads = new Map<string, LegPayload>();
    for (const r of requested) {
      const raw = candlesByAddr.get(r.address) ?? [];
      const closes = this.extractCloses(raw);
      if (closes.length >= 2) {
        payloads.set(r.symbol, { closes, weight: r.weight, symbol: r.symbol });
      }
    }

    if (payloads.size < 2 && errors.length > 0) {
      const fail: BacktestResult = {
        status: 'nansen-error',
        message: `backtest OHLCV unavailable: ${errors.map((e) => `${e.chain} — ${e.message}`).join('; ')}`,
        days: safeDays,
        windowStart: fromIso,
        windowEnd: toIso,
        universeSize: 0,
        requestedSize: requested.length,
        startNav: 1,
        endNav: 1,
        returnPct: 0,
        maxDrawdownPct: 0,
        bestDay: null,
        worstDay: null,
        series: [],
        legs: [],
        generatedAt: new Date().toISOString(),
      };
      this.cache = { key, data: fail, at: now };
      return fail;
    }

    if (payloads.size === 0) {
      const empty = this.emptyResult(safeDays, 'no OHLCV history returned for current universe', requested.length, 0, fromIso, toIso);
      this.cache = { key, data: empty, at: now };
      return empty;
    }

    const maxLen = Math.max(...[...payloads.values()].map((p) => p.closes.length));
    if (maxLen < 2) {
      const empty = this.emptyResult(safeDays, 'aligned OHLCV window too short (need ≥2 candles)', requested.length, payloads.size, fromIso, toIso);
      this.cache = { key, data: empty, at: now };
      return empty;
    }

    const alignedPayloads = new Map<string, { closes: number[]; weight: number; symbol: string }>();
    for (const [sym, p] of payloads) {
      alignedPayloads.set(sym, {
        closes: p.closes.slice(-maxLen),
        weight: p.weight,
        symbol: p.symbol,
      });
    }
    const payloadsAligned = alignedPayloads;
    const alignedLength = maxLen;

    const dates = this.backDateLabels(alignedLength, toIso);
    const series: BacktestPoint[] = [];
    const dailyReturns: { date: string; pct: number }[] = [];
    let startNav = 1;
    let peak = 1;
    let maxDd = 0;
    let prevNav = 1;
    const totalW = this.totalWeight(payloadsAligned);

    for (let i = 0; i < alignedLength; i++) {
      let weightedSum = 0;
      let weightUsed = 0;
      for (const p of payloadsAligned.values()) {
        const close = p.closes[i];
        const base = p.closes[0];
        if (base <= 0 || close <= 0) continue;
        const ret = close / base;
        const w = p.weight / totalW;
        weightedSum += w * ret;
        weightUsed += w;
      }
      if (weightUsed === 0) continue;
      const nav = Number((weightedSum / weightUsed).toFixed(6));
      const date = dates[i];
      series.push({ date, nav });

      if (i === 0) {
        startNav = nav;
        prevNav = nav;
      } else {
        const pct = ((nav - prevNav) / prevNav) * 100;
        dailyReturns.push({ date, pct });
        prevNav = nav;
      }
      if (nav > peak) peak = nav;
      const dd = ((peak - nav) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }

    let bestDay: { date: string; pct: number } | null = null;
    let worstDay: { date: string; pct: number } | null = null;
    if (dailyReturns.length >= 2) {
      bestDay = dailyReturns[0];
      worstDay = dailyReturns[0];
      for (const r of dailyReturns) {
        if (r.pct > bestDay.pct) bestDay = r;
        if (r.pct < worstDay.pct) worstDay = r;
      }
    }

    const endNav = series.length > 0 ? series[series.length - 1].nav : 1;
    const returnPct = startNav === 0 ? 0 : ((endNav - startNav) / startNav) * 100;

    const legs: BacktestLeg[] = [];
    for (const p of payloadsAligned.values()) {
      const first = p.closes[0];
      const last = p.closes[p.closes.length - 1];
      const legRet = first > 0 ? ((last - first) / first) * 100 : 0;
      legs.push({
        symbol: p.symbol,
        weight: Number(p.weight.toFixed(2)),
        returnPct: Number(legRet.toFixed(2)),
        candles: p.closes.length,
      });
    }
    legs.sort((a, b) => b.returnPct - a.returnPct);

    const result: BacktestResult = {
      status: 'ok',
      message: null,
      days: safeDays,
      windowStart: dates[0] ?? fromIso,
      windowEnd: dates[dates.length - 1] ?? toIso,
      universeSize: payloads.size,
      requestedSize: requested.length,
      startNav: Number(startNav.toFixed(4)),
      endNav: Number(endNav.toFixed(4)),
      returnPct: Number(returnPct.toFixed(2)),
      maxDrawdownPct: Number(maxDd.toFixed(2)),
      bestDay: bestDay ? { date: bestDay.date, pct: Number(bestDay.pct.toFixed(2)) } : null,
      worstDay: worstDay ? { date: worstDay.date, pct: Number(worstDay.pct.toFixed(2)) } : null,
      series,
      legs,
      generatedAt: new Date().toISOString(),
    };

    this.cache = { key, data: result, at: now };
    return result;
  }

  private extractCloses(candles: OhlcvCandle[]): number[] {
    const out: number[] = [];
    for (const c of candles) {
      const close = Number(c.close);
      if (Number.isFinite(close) && close > 0) out.push(close);
    }
    return out;
  }

  private backDateLabels(length: number, endIso: string): string[] {
    const end = new Date(`${endIso}T00:00:00.000Z`);
    const out: string[] = [];
    for (let i = length - 1; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }

  private clampDays(days: number): number {
    if (!Number.isFinite(days) || days <= 0) return 30;
    return Math.min(Math.max(1, Math.floor(days)), 90);
  }

  private totalWeight(payloads: Map<string, LegPayload>): number {
    let w = 0;
    for (const v of payloads.values()) w += v.weight;
    return w || 1;
  }

  private emptyResult(
    days: number,
    message: string,
    requestedSize: number,
    universeSize: number,
    fromIso = '',
    toIso = '',
  ): BacktestResult {
    return {
      status: 'no-data',
      message,
      days,
      windowStart: fromIso,
      windowEnd: toIso,
      universeSize,
      requestedSize,
      startNav: 1,
      endNav: 1,
      returnPct: 0,
      maxDrawdownPct: 0,
      bestDay: null,
      worstDay: null,
      series: [],
      legs: [],
      generatedAt: new Date().toISOString(),
    };
  }
}
