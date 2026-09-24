import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IndexService } from './index.service.js';
import { NansenError, NansenService } from '../nansen/nansen.service.js';
import { loadConfig } from '../config/config.js';
import type { TokenWeight } from './index.analytics.js';

class FakeNansen {
  private flow: any = {
    tokens: [
      { symbol: 'ETH', smart_money_score: 90, whale_concentration: 40 },
      { symbol: 'SOL', smart_money_score: 80, whale_concentration: 30 },
      { symbol: 'ARB', smart_money_score: 70, whale_concentration: 25 },
      { symbol: 'OP', smart_money_score: 60, whale_concentration: 20 },
      { symbol: 'MATIC', smart_money_score: 50, whale_concentration: 15 },
      { symbol: 'AVAX', smart_money_score: 45, whale_concentration: 12 },
      { symbol: 'LINK', smart_money_score: 40, whale_concentration: 10 },
      { symbol: 'UNI', smart_money_score: 35, whale_concentration: 8 },
      { symbol: 'AAVE', smart_money_score: 30, whale_concentration: 7 },
      { symbol: 'CRV', smart_money_score: 25, whale_concentration: 5 },
      { symbol: 'MKR', smart_money_score: 22, whale_concentration: 4 },
      { symbol: 'SNX', smart_money_score: 20, whale_concentration: 3 },
    ],
  };
  private counter = 0;
  failNext: 'nansen-error' | 'nansen-empty' | null = null;
  setFlow(f: any) { this.flow = f; }
  setEmpty() { this.flow = { tokens: [] }; }
  getSmartMoneyFlow = vi.fn(async (_limit: number) => {
    this.counter++;
    if (this.failNext === 'nansen-error') {
      this.failNext = null;
      throw new NansenError('nansen down');
    }
    if (this.failNext === 'nansen-empty') {
      this.failNext = null;
      this.flow = { tokens: [] };
    }
    return this.flow;
  });
  getCallCount() { return this.counter; }
}

describe('IndexService', () => {
  let svc: IndexService;
  let nansen: FakeNansen;

  const build = (envOverrides: Record<string, string> = {}) => {
    for (const [k, v] of Object.entries(envOverrides)) process.env[k] = v;
    const cfg = loadConfig();
    nansen = new FakeNansen();
    svc = new IndexService(nansen as unknown as NansenService, cfg);
  };

  beforeEach(() => {
    delete process.env.CACHE_TTL_SECONDS;
    delete process.env.REBALANCE_THRESHOLD;
    build();
  });

  describe('current()', () => {
    it('returns normalised, sorted tokens from Nansen', async () => {
      const out = await svc.current();
      expect(out.tokens.length).toBe(12);
      const sum = out.tokens.reduce((s: number, t: TokenWeight) => s + t.weight, 0);
      expect(sum).toBeCloseTo(100, 1);
      for (let i = 1; i < out.tokens.length; i++) {
        expect(out.tokens[i - 1].weight).toBeGreaterThanOrEqual(out.tokens[i].weight);
      }
      expect(out.status).toBe('ok');
      expect(out.message).toBeNull();
    });

    it('falls back to hardcoded tokens and reports status="fallback" when Nansen throws', async () => {
      nansen.failNext = 'nansen-error';
      const out = await svc.current();
      const symbols = out.tokens.map((t: TokenWeight) => t.symbol);
      expect(symbols.slice(0, 5)).toEqual(['ETH', 'ARB', 'OP', 'SOL', 'MATIC']);
      expect(out.status).toBe('fallback');
      expect(out.message).toMatch(/Nansen/i);
    });

    it('reports status="nansen-empty" when Nansen returns an empty list', async () => {
      nansen.failNext = 'nansen-empty';
      const out = await svc.current();
      expect(out.status).toBe('nansen-empty');
      expect(out.message).toMatch(/no index data/i);
    });

    it('exposes the Nansen call counter', async () => {
      const out = await svc.current();
      expect(typeof out.apiCalls).toBe('number');
      expect(out.apiCalls).toBe(1);
    });

    it('caches within the TTL', async () => {
      build({ CACHE_TTL_SECONDS: '60' });
      await svc.current();
      await svc.current();
      await svc.current();
      expect(nansen.getSmartMoneyFlow).toHaveBeenCalledTimes(1);
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
      nansen.setFlow({
        tokens: [
          { symbol: 'ETH', smart_money_score: 10, whale_concentration: 5 },
          { symbol: 'SOL', smart_money_score: 10, whale_concentration: 5 },
          ...Array.from({ length: 10 }, (_, i) => ({
            symbol: `T${i}`,
            smart_money_score: 10,
            whale_concentration: 5,
          })),
        ],
      });
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
