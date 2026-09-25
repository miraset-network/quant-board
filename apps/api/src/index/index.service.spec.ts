import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IndexService } from './index.service.js';
import { NansenError, NansenService, SmartMoneyNetflowRow } from '../nansen/nansen.service.js';
import { loadConfig } from '../config/config.js';
import type { TokenWeight } from './index.analytics.js';
import { CacheService } from '../cache/cache.service.js';

const baseRow = (over: Partial<SmartMoneyNetflowRow> = {}): SmartMoneyNetflowRow => ({
  token_address: '0xeth',
  token_symbol: 'ETH',
  chain: 'ethereum',
  net_flow_1h_usd: 0,
  net_flow_24h_usd: 50000,
  net_flow_7d_usd: 200000,
  net_flow_30d_usd: 800000,
  trader_count: 50,
  token_age_days: 2000,
  market_cap_usd: 200_000_000,
  ...over,
});

class FakeNansen {
  private rows: SmartMoneyNetflowRow[] = [
    baseRow({ token_symbol: 'ETH', net_flow_24h_usd: 50000, trader_count: 50, market_cap_usd: 200_000_000 }),
    baseRow({ token_symbol: 'SOL', token_address: '0xsol', chain: 'solana', net_flow_24h_usd: 30000, trader_count: 40, market_cap_usd: 80_000_000 }),
    baseRow({ token_symbol: 'ARB', token_address: '0xarb', net_flow_24h_usd: 20000, trader_count: 30, market_cap_usd: 30_000_000 }),
    baseRow({ token_symbol: 'OP', token_address: '0xop', net_flow_24h_usd: 10000, trader_count: 25, market_cap_usd: 20_000_000 }),
    baseRow({ token_symbol: 'MATIC', token_address: '0xmatic', net_flow_24h_usd: -5000, trader_count: 20, market_cap_usd: 15_000_000 }),
    baseRow({ token_symbol: 'AVAX', token_address: '0xavax', net_flow_24h_usd: -10000, trader_count: 18, market_cap_usd: 12_000_000 }),
    baseRow({ token_symbol: 'LINK', token_address: '0xlink', net_flow_24h_usd: -20000, trader_count: 15, market_cap_usd: 8_000_000 }),
    baseRow({ token_symbol: 'UNI', token_address: '0xuni', net_flow_24h_usd: -30000, trader_count: 12, market_cap_usd: 5_000_000 }),
    baseRow({ token_symbol: 'AAVE', token_address: '0xaave', net_flow_24h_usd: -40000, trader_count: 10, market_cap_usd: 3_000_000 }),
    baseRow({ token_symbol: 'CRV', token_address: '0xcrv', net_flow_24h_usd: -50000, trader_count: 8, market_cap_usd: 2_000_000 }),
    baseRow({ token_symbol: 'MKR', token_address: '0xmkr', net_flow_24h_usd: -60000, trader_count: 6, market_cap_usd: 1_500_000 }),
    baseRow({ token_symbol: 'SNX', token_address: '0xsnx', net_flow_24h_usd: -80000, trader_count: 4, market_cap_usd: 1_000_000 }),
  ];
  private empty = false;
  failNext: 'error' | null = null;
  setRows(r: SmartMoneyNetflowRow[]) { this.rows = r; }
  setEmpty() { this.empty = true; }
  getSmartMoneyNetflow = vi.fn(async () => {
    if (this.failNext === 'error') {
      this.failNext = null;
      throw new NansenError('nansen down', 500);
    }
    if (this.empty) return { data: [] };
    return { data: this.rows };
  });
  getCallCount() { return 1; }
  getSuccessCount() { return 1; }
  getLastError() { return null; }
  getCredits() {
    return {
      includedRemaining: null,
      includedLimit: null,
      purchasedRemaining: null,
      plan: null,
      costLastCall: null,
      source: 'unknown' as const,
      updatedAt: new Date(0).toISOString(),
    };
  }
  getAccount = vi.fn(async () => ({}));
  getOhlcvBatch = vi.fn(async () => ({ chain: 'solana', timeframe: '1d', tokens: [] }));
}

describe('IndexService', () => {
  let svc: IndexService;
  let nansen: FakeNansen;

  const build = (envOverrides: Record<string, string> = {}) => {
    for (const [k, v] of Object.entries(envOverrides)) process.env[k] = v;
    const cfg = loadConfig();
    nansen = new FakeNansen();
    const cache = new CacheService(cfg);
    svc = new IndexService(nansen as unknown as NansenService, cache, cfg);
  };

  beforeEach(() => {
    delete process.env.CACHE_TTL_SECONDS;
    delete process.env.REBALANCE_THRESHOLD;
    build();
  });

  describe('current()', () => {
    it('returns normalised, sorted tokens derived from real Nansen rows', async () => {
      const out = await svc.current();
      expect(out.tokens.length).toBe(12);
      const sum = out.tokens.reduce((s: number, t: TokenWeight) => s + t.weight, 0);
      expect(sum).toBeCloseTo(100, 1);
      for (let i = 1; i < out.tokens.length; i++) {
        expect(out.tokens[i - 1].weight).toBeGreaterThanOrEqual(out.tokens[i].weight);
      }
      expect(out.status).toBe('ok');
      expect(out.source).toBe('nansen');
      expect(out.message).toBeNull();
      expect(out.successfulCalls).toBe(1);
      expect(out.nansenRows?.length).toBe(12);
    });

    it('returns empty tokens and nansen-error when Nansen throws', async () => {
      nansen.failNext = 'error';
      const out = await svc.current();
      expect(out.tokens).toEqual([]);
      expect(out.status).toBe('nansen-error');
      expect(out.source).toBe('nansen');
      expect(out.message).toMatch(/Nansen/i);
    });

    it('reports status="nansen-empty" when Nansen returns no data', async () => {
      nansen.setEmpty();
      const out = await svc.current();
      expect(out.status).toBe('nansen-empty');
      expect(out.tokens).toEqual([]);
      expect(out.message).toMatch(/no netflow/i);
    });

    it('exposes both total and successful call counters', async () => {
      const out = await svc.current();
      expect(typeof out.apiCalls).toBe('number');
      expect(typeof out.successfulCalls).toBe('number');
    });

    it('caches within the TTL', async () => {
      build({ CACHE_TTL_SECONDS: '60' });
      await svc.current();
      await svc.current();
      await svc.current();
      expect(nansen.getSmartMoneyNetflow).toHaveBeenCalledTimes(1);
    });
  });

  describe('rebalance() (Bug 1 regression)', () => {
    it('produces non-HOLD actions with real signed diffs on the first poll', async () => {
      const reb = await svc.rebalance();
      const diffs = reb.actions.map((a) => parseFloat(a.change));
      expect(diffs.some((d) => d !== 0)).toBe(true);
      expect(reb.actions.every((a) => typeof a.token === 'string' && a.token.length > 0)).toBe(true);
      expect(typeof reb.drift).toBe('number');
      expect(reb.drift).toBeGreaterThan(0);
    });

    it('every action label matches the sign of its diff', async () => {
      const reb = await svc.rebalance();
      for (const a of reb.actions) {
        const d = parseFloat(a.change);
        if (Math.abs(d) < 0.5) {
          expect(a.action).toBe('HOLD');
        } else if (d > 0) {
          expect(a.action).toBe('BUY');
        } else {
          expect(a.action).toBe('SELL');
        }
      }
    });

    it('reflects changed inputs between polls', async () => {
      build({ CACHE_TTL_SECONDS: '0' });
      const r1 = await svc.rebalance();
      nansen.setRows([
        baseRow({ token_symbol: 'ETH', net_flow_24h_usd: 1, trader_count: 1, market_cap_usd: 1 }),
        baseRow({ token_symbol: 'SOL', token_address: '0xsol', chain: 'solana', net_flow_24h_usd: 1, trader_count: 1, market_cap_usd: 1 }),
        ...Array.from({ length: 10 }, (_, i) =>
          baseRow({ token_symbol: `T${i}`, token_address: `0xt${i}`, net_flow_24h_usd: 1, trader_count: 1, market_cap_usd: 1 }),
        ),
      ]);
      const r2 = await svc.rebalance();
      const driftChanged = r1.drift !== r2.drift;
      const actionsChanged = JSON.stringify(r1.actions) !== JSON.stringify(r2.actions);
      expect(driftChanged || actionsChanged).toBe(true);
    });

    it('triggered boolean is derived from drift vs threshold', async () => {
      build({ REBALANCE_THRESHOLD: '0.5' });
      const reb = await svc.rebalance();
      expect(reb.triggered).toBe(reb.drift / 100 > 0.5);
    });

    it('confidence is in [0, 0.95]', async () => {
      const reb = await svc.rebalance();
      expect(reb.confidence).toBeGreaterThanOrEqual(0);
      expect(reb.confidence).toBeLessThanOrEqual(0.95);
    });
  });
});
