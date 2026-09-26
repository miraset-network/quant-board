import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BacktestService } from './backtest.service.js';
import { IndexService } from '../index/index.service.js';
import { NansenService } from '../nansen/nansen.service.js';
import { loadConfig } from '../config/config.js';
import type { IndexState } from '../index/index.service.js';

function makeIndexState(tokens: { symbol: string; weight: number }[]): IndexState {
  return {
    indexName: 't',
    lastUpdate: new Date().toISOString(),
    tokens: tokens.map((t) => ({
      symbol: t.symbol,
      weight: t.weight,
      smartMoneyScore: 50,
      correlation: 0.9,
      whaleConcentration: 30,
    })),
    apiCalls: 0,
    successfulCalls: 0,
    status: 'ok',
    message: null,
    source: 'nansen',
    nansenRows: tokens.map((t, i) => ({
      token_address: `0x${t.symbol.toLowerCase()}${i}`,
      token_symbol: t.symbol,
      chain: 'solana',
      net_flow_1h_usd: 0,
      net_flow_24h_usd: 1000 * (tokens.length - i),
      net_flow_7d_usd: 0,
      net_flow_30d_usd: 0,
      trader_count: 10,
      token_age_days: 100,
      market_cap_usd: 1_000_000,
    })),
  };
}

function fakeIndex(state: IndexState): Partial<IndexService> {
  return { current: vi.fn(async () => state) };
}

function fakeNansen(impl: Partial<NansenService>): Partial<NansenService> {
  return {
    getOhlcvBatch: vi.fn(async () => impl.getOhlcvBatch!({} as any)),
    getCallCount: () => 1,
    getSuccessCount: () => 1,
    getLastError: () => null,
    getCredits: () => ({
      includedRemaining: null,
      includedLimit: null,
      purchasedRemaining: null,
      plan: null,
      costLastCall: null,
      source: 'unknown',
      updatedAt: new Date().toISOString(),
    }),
    ...impl,
  };
}

function candleRow(closes: number[]) {
  return closes.map((close) => ({
    interval_start: '',
    open: close,
    high: close,
    low: close,
    close,
    volume: 0,
    volume_usd: 0,
    market_cap: { open: 0, high: 0, low: 0, close: 0 },
  }));
}

describe('BacktestService', () => {
  beforeEach(() => {
    delete process.env.CACHE_TTL_SECONDS;
  });

  it('returns no-data when the index has no tokens', async () => {
    const cfg = loadConfig();
    const idx = makeIndexState([]);
    const svc = new BacktestService(
      fakeIndex(idx) as IndexService,
      fakeNansen({}) as NansenService,
      cfg,
    );
    const out = await svc.run(30);
    expect(out.status).toBe('no-data');
    expect(out.series).toEqual([]);
  });

  it('computes buy-and-hold NAV curve over equal-weight portfolio', async () => {
    const cfg = loadConfig();
    const idx = makeIndexState([
      { symbol: 'A', weight: 50 },
      { symbol: 'B', weight: 50 },
    ]);
    // Generate 30 candles: A goes 10→19 (+90%), B goes 20→38 (+90%)
    const closesA = Array.from({ length: 30 }, (_, i) => 10 + i * 0.31);
    const closesB = Array.from({ length: 30 }, (_, i) => 20 + i * 0.62);
    const svc = new BacktestService(
      fakeIndex(idx) as IndexService,
      fakeNansen({
        getOhlcvBatch: vi.fn(async () => ({
          chain: 'solana',
          timeframe: '1d',
          tokens: [
            { token_address: '0xa0', data: candleRow(closesA) },
            { token_address: '0xb1', data: candleRow(closesB) },
          ],
        })),
      }) as NansenService,
      cfg,
    );
    const out = await svc.run(30);
    expect(out.status).toBe('ok');
    expect(out.series.length).toBe(30);
    expect(out.startNav).toBe(1);
    const lastRetA = (closesA[29] - closesA[0]) / closesA[0];
    const lastRetB = (closesB[29] - closesB[0]) / closesB[0];
    const expectedEnd = (lastRetA + lastRetB) / 2 + 1;
    expect(Math.abs(out.endNav - Number(expectedEnd.toFixed(4)))).toBeLessThan(0.001);
    expect(out.returnPct).toBeGreaterThan(0);
    expect(out.legs).toHaveLength(2);
    expect(out.maxDrawdownPct).toBe(0);
  });

  it('distinguishes best and worst day even when first return is positive', async () => {
    const cfg = loadConfig();
    const idx = makeIndexState([
      { symbol: 'A', weight: 50 },
      { symbol: 'B', weight: 50 },
    ]);
    // 30 candles with ups and downs
    const closesA = [10, 12, 9, 11, 13, 10, 8, 14, 12, 10, 11, 13, 9, 7, 12, 14, 11, 10, 13, 15, 12, 10, 9, 11, 13, 10, 8, 12, 14, 11];
    const closesB = [20, 22, 18, 25, 24, 20, 19, 23, 21, 20, 22, 24, 19, 17, 22, 25, 21, 20, 23, 26, 22, 20, 19, 21, 23, 20, 18, 22, 25, 21];
    const svc = new BacktestService(
      fakeIndex(idx) as IndexService,
      fakeNansen({
        getOhlcvBatch: vi.fn(async () => ({
          chain: 'solana',
          timeframe: '1d',
          tokens: [
            { token_address: '0xa0', data: candleRow(closesA) },
            { token_address: '0xb1', data: candleRow(closesB) },
          ],
        })),
      }) as NansenService,
      cfg,
    );
    const out = await svc.run(30);
    expect(out.bestDay).not.toBeNull();
    expect(out.worstDay).not.toBeNull();
    expect(out.bestDay!.pct).toBeGreaterThan(0);
    expect(out.worstDay!.pct).toBeLessThan(0);
    expect(out.bestDay!.date).not.toBe(out.worstDay!.date);
    expect(out.maxDrawdownPct).toBeGreaterThan(0);
  });

  it('tags daily return to the previous day, not the current nav day', async () => {
    const cfg = loadConfig();
    const idx = makeIndexState([{ symbol: 'A', weight: 100 }]);
    // 30 candles: day 0→1 is +100%, day 1→2 is -75%
    const closes = [10, 20, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const svc = new BacktestService(
      fakeIndex(idx) as IndexService,
      fakeNansen({
        getOhlcvBatch: vi.fn(async () => ({
          chain: 'solana',
          timeframe: '1d',
          tokens: [{ token_address: '0xa0', data: candleRow(closes) }],
        })),
      }) as NansenService,
      cfg,
    );
    const out = await svc.run(30);
    expect(out.series).toHaveLength(30);
    expect(out.dailyReturns ?? out.bestDay).toBeTruthy();
    // Day 0 -> day 1 is +100%, attributed to day 0; day 1 -> day 2 is -75%, attributed to day 1.
    expect(out.bestDay!.pct).toBe(100);
    expect(out.worstDay!.pct).toBe(-75);
    expect(out.bestDay!.date).not.toBe(out.worstDay!.date);
  });

  it('returns null best/worst when only one daily return exists', async () => {
    const cfg = loadConfig();
    const idx = makeIndexState([
      { symbol: 'A', weight: 50 },
      { symbol: 'B', weight: 50 },
    ]);
    // Only 2 candles → below minCandles threshold → no data
    const svc = new BacktestService(
      fakeIndex(idx) as IndexService,
      fakeNansen({
        getOhlcvBatch: vi.fn(async () => ({
          chain: 'solana',
          timeframe: '1d',
          tokens: [
            { token_address: '0xa0', data: candleRow([10, 12]) },
            { token_address: '0xb1', data: candleRow([20, 24]) },
          ],
        })),
      }) as NansenService,
      cfg,
    );
    const out = await svc.run(30);
    // Tokens with < minCandles are excluded → no-data status
    expect(out.status).toBe('no-data');
    expect(out.bestDay).toBeNull();
    expect(out.worstDay).toBeNull();
  });

  it('excludes tokens with fewer than minCandles from backtest', async () => {
    const cfg = loadConfig();
    const idx = makeIndexState([
      { symbol: 'A', weight: 50 },
      { symbol: 'B', weight: 50 },
    ]);
    const closesA = Array.from({ length: 30 }, (_, i) => 10 + i * 0.1); // 30 candles
    const closesB = [20, 21]; // only 2 candles → below minCandles
    const svc = new BacktestService(
      fakeIndex(idx) as IndexService,
      fakeNansen({
        getOhlcvBatch: vi.fn(async () => ({
          chain: 'solana',
          timeframe: '1d',
          tokens: [
            { token_address: '0xa0', data: candleRow(closesA) },
            { token_address: '0xb1', data: candleRow(closesB) },
          ],
        })),
      }) as NansenService,
      cfg,
    );
    const out = await svc.run(30);
    // Only token A has enough candles → backtest runs with 1 token
    expect(out.status).toBe('ok');
    expect(out.series).toHaveLength(30);
    expect(out.legs).toHaveLength(1);
    expect(out.legs[0].symbol).toBe('A');
    // Every NAV must be a finite number — no NaN
    for (const pt of out.series) {
      expect(Number.isFinite(pt.nav)).toBe(true);
    }
    // NAV tracks A: 10 → 12.9 over 30 candles
    expect(out.series[0].nav).toBe(1);
    expect(out.series[29].nav).toBeCloseTo(1.29, 2);
    expect(Number.isFinite(out.endNav)).toBe(true);
    expect(Number.isFinite(out.returnPct)).toBe(true);
  });

  it('clamps days to [1, 90] range', async () => {
    const cfg = loadConfig();
    const idx = makeIndexState([]);
    const svc = new BacktestService(
      fakeIndex(idx) as IndexService,
      fakeNansen({}) as NansenService,
      cfg,
    );
    const out0 = await svc.run(0);
    expect(out0.days).toBe(30);
    const outOver = await svc.run(500);
    expect(outOver.days).toBe(90);
  });
});
