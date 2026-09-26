import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArbitrageService } from './arbitrage.service.js';
import { IndexService } from '../index/index.service.js';
import { NansenError, NansenService } from '../nansen/nansen.service.js';
import { loadConfig } from '../config/config.js';
import type { IndexState } from '../index/index.service.js';

function ar(phi: number, n: number, seed = 1): number[] {
  let s = seed;
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const noise = (s / 233280 - 0.5) * 0.3;
    const v = phi * prev + noise;
    out.push(v);
    prev = v;
  }
  return out;
}

function makeCointegratedSeries(
  n = 20,
  dropA = false,
  dropB = false,
): [number[], number[]] {
  const common = ar(0.6, n, 1);
  const a0 = ar(0.6, n, 2);
  const b0 = ar(0.6, n, 3);
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    a.push(10 + 5 * common[i] + 0.02 * a0[i] + i * 0.05);
    b.push(10 + 5 * common[i] + 0.02 * b0[i] + i * 0.05);
  }
  if (dropA) a[a.length - 1] *= 0.92;
  if (dropB) b[b.length - 1] *= 0.85;
  return [a, b];
}

function makeIndexState(tokens: { symbol: string; weight: number }[], opts: Partial<IndexState> = {}): IndexState {
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
    ...opts,
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
    getSmartMoneyNetflow: vi.fn(async () => ({ data: [] })),
    ...impl,
  };
}

describe('ArbitrageService', () => {
  beforeEach(() => {
    delete process.env.ARB_CORR_THRESHOLD;
    delete process.env.ARB_DIV_THRESHOLD;
    delete process.env.CACHE_TTL_SECONDS;
  });

  const build = (
    tokens: { symbol: string; weight: number }[],
    envOverrides: Record<string, string> = {},
    stateOpts: Partial<IndexState> = {},
    nansenImpl: Partial<NansenService> = {},
  ) => {
    for (const [k, v] of Object.entries(envOverrides)) process.env[k] = v;
    const cfg = loadConfig();
    const idxState = makeIndexState(tokens, stateOpts);
    return new ArbitrageService(
      fakeIndex(idxState) as IndexService,
      fakeNansen(nansenImpl) as NansenService,
      cfg,
    );
  };

  it('returns nansen-empty when index has no tokens', async () => {
    const svc = build([], {}, { status: 'nansen-empty' });
    const out = await svc.opportunities();
    expect(out.status).toBe('nansen-empty');
    expect(out.opportunities).toEqual([]);
  });

  it('returns nansen-error when index status is nansen-error', async () => {
    const svc = build([{ symbol: 'ETH', weight: 50 }], {}, { status: 'nansen-error', message: 'Nansen 403' });
    const out = await svc.opportunities();
    expect(out.status).toBe('nansen-error');
    expect(out.message).toMatch(/Nansen 403/);
  });

  it('returns nansen-empty when no-threshold-match with insufficient addresses', async () => {
    const svc = build([{ symbol: 'ETH', weight: 100 }], {}, { nansenRows: [] });
    const out = await svc.opportunities();
    expect(out.status).toBe('no-threshold-match');
  });

  it('returns ok when OHLCV produces a divergent correlated pair', async () => {
    const tokens = [
      { symbol: 'A', weight: 50 },
      { symbol: 'B', weight: 50 },
    ];
    const [closesA, closesB] = makeCointegratedSeries(20, false, true);
    const svc = build(
      tokens,
      { ARB_CORR_THRESHOLD: '0.5', ARB_DIV_THRESHOLD: '0.01' },
      {},
      {
        getOhlcvBatch: vi.fn(async () => ({
          chain: 'solana',
          timeframe: '1d',
          tokens: [
            { token_address: '0xa0', data: closesA.map((close) => ({ interval_start: '', open: close, high: close, low: close, close, volume: 0, volume_usd: 0, market_cap: { open: 0, high: 0, low: 0, close: 0 } })) },
            { token_address: '0xb1', data: closesB.map((close) => ({ interval_start: '', open: close, high: close, low: close, close, volume: 0, volume_usd: 0, market_cap: { open: 0, high: 0, low: 0, close: 0 } })) },
          ],
        })),
      },
    );
    const out = await svc.opportunities();
    expect(out.opportunities.length).toBeGreaterThan(0);
    expect(out.status).toBe('ok');
    const o = out.opportunities[0];
    expect(o.zScore).toBeDefined();
    expect(o.beta).toBeDefined();
    expect(typeof o.halfLifeDays).toBe('number');
    expect(o.hedgeNotionals.legA).toBe(1);
  });

  it('returns no-threshold-match when OHLCV returns empty arrays', async () => {
    const tokens = [{ symbol: 'A', weight: 50 }, { symbol: 'B', weight: 50 }];
    const svc = build(
      tokens,
      {},
      {},
      { getOhlcvBatch: vi.fn(async () => ({ chain: 'solana', timeframe: '1d', tokens: [] })) },
    );
    const out = await svc.opportunities();
    expect(out.status).toBe('no-threshold-match');
  });

  it('reports nansen-error when all OHLCV requests fail with the same message', async () => {
    const tokens = [{ symbol: 'A', weight: 50 }, { symbol: 'B', weight: 50 }];
    const svc = build(
      tokens,
      {},
      {},
      { getOhlcvBatch: vi.fn(async () => { throw new NansenError('boom', 500); }) },
    );
    const out = await svc.opportunities();
    expect(out.status).toBe('nansen-error');
    expect(out.opportunities).toEqual([]);
    expect(out.message).toMatch(/OHLCV unavailable.*boom/);
  });

  it('emits the correct signal direction based on z-score sign', async () => {
    const [closesA, closesB] = makeCointegratedSeries(20, false, true);
    const svc = build(
      [{ symbol: 'A', weight: 50 }, { symbol: 'B', weight: 50 }],
      { ARB_CORR_THRESHOLD: '0.5', ARB_DIV_THRESHOLD: '0.01' },
      {},
      {
        getOhlcvBatch: vi.fn(async () => ({
          chain: 'solana',
          timeframe: '1d',
          tokens: [
            { token_address: '0xa0', data: closesA.map((close) => ({ interval_start: '', open: close, high: close, low: close, close, volume: 0, volume_usd: 0, market_cap: { open: 0, high: 0, low: 0, close: 0 } })) },
            { token_address: '0xb1', data: closesB.map((close) => ({ interval_start: '', open: close, high: close, low: close, close, volume: 0, volume_usd: 0, market_cap: { open: 0, high: 0, low: 0, close: 0 } })) },
          ],
        })),
      },
    );
    const out = await svc.opportunities();
    expect(out.opportunities.length).toBeGreaterThan(0);
    const o = out.opportunities[0];
    expect(o.signal).toBe(`LONG_${o.pair.split('/')[1]}_SHORT_${o.pair.split('/')[0]}`);
    expect(o.zScore).toBeGreaterThan(0);
  });

  it('returns no-threshold-match when z-score is below entry threshold', async () => {
    const closesA = [10, 10.1, 10.2, 10.15, 10.25, 10.3, 10.35, 10.4];
    const closesB = closesA.slice();
    closesB[closesB.length - 1] = 10.41;
    const svc = build(
      [{ symbol: 'A', weight: 50 }, { symbol: 'B', weight: 50 }],
      { ARB_CORR_THRESHOLD: '0.5', ARB_DIV_THRESHOLD: '0.01' },
      {},
      {
        getOhlcvBatch: vi.fn(async () => ({
          chain: 'solana',
          timeframe: '1d',
          tokens: [
            { token_address: '0xa0', data: closesA.map((close) => ({ interval_start: '', open: close, high: close, low: close, close, volume: 0, volume_usd: 0, market_cap: { open: 0, high: 0, low: 0, close: 0 } })) },
            { token_address: '0xb1', data: closesB.map((close) => ({ interval_start: '', open: close, high: close, low: close, close, volume: 0, volume_usd: 0, market_cap: { open: 0, high: 0, low: 0, close: 0 } })) },
          ],
        })),
      },
    );
    const out = await svc.opportunities();
    expect(out.status).toBe('no-threshold-match');
    expect(out.opportunities).toEqual([]);
  });

  it('reports half-life when spread is mean-reverting', async () => {
    const [closesA, closesB] = makeCointegratedSeries(20, true, false);
    const svc = build(
      [{ symbol: 'A', weight: 50 }, { symbol: 'B', weight: 50 }],
      { ARB_CORR_THRESHOLD: '0.5', ARB_DIV_THRESHOLD: '0.01' },
      {},
      {
        getOhlcvBatch: vi.fn(async () => ({
          chain: 'solana',
          timeframe: '1d',
          tokens: [
            { token_address: '0xa0', data: closesA.map((close) => ({ interval_start: '', open: close, high: close, low: close, close, volume: 0, volume_usd: 0, market_cap: { open: 0, high: 0, low: 0, close: 0 } })) },
            { token_address: '0xb1', data: closesB.map((close) => ({ interval_start: '', open: close, high: close, low: close, close, volume: 0, volume_usd: 0, market_cap: { open: 0, high: 0, low: 0, close: 0 } })) },
          ],
        })),
      },
    );
    const out = await svc.opportunities();
    expect(out.opportunities.length).toBeGreaterThan(0);
    const o = out.opportunities[0];
    expect(typeof o.halfLifeDays).toBe('number');
    expect(typeof o.halfLifeOk).toBe('boolean');
  });
});
