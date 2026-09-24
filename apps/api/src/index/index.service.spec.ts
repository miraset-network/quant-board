import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IndexService } from './index.service.js';
import { NansenService } from '../nansen/nansen.service.js';
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
  failNext = false;
  setFlow(f: any) { this.flow = f; }
  getSmartMoneyFlow = vi.fn(async (_limit: number) => {
    this.counter++;
    if (this.failNext) {
      this.failNext = false;
      throw new Error('nansen down');
    }
    return this.flow;
  });
  getCallCount() { return this.counter; }
}

const _flush = () => new Promise<void>((r) => setImmediate(r));

describe('IndexService', () => {
  let svc: IndexService;
  let nansen: FakeNansen;

  beforeEach(() => {
    process.env.CACHE_TTL_SECONDS = '0';
    nansen = new FakeNansen();
    svc = new IndexService(nansen as unknown as NansenService);
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
    });

    it('falls back to hardcoded tokens when Nansen throws', async () => {
      nansen.failNext = true;
      const out = await svc.current();
      const symbols = out.tokens.map((t: TokenWeight) => t.symbol);
      expect(symbols.slice(0, 5)).toEqual(['ETH', 'ARB', 'OP', 'SOL', 'MATIC']);
    });

    it('exposes the Nansen call counter', async () => {
      const out = await svc.current();
      expect(typeof out.apiCalls).toBe('number');
      expect(out.apiCalls).toBe(1);
    });

    it('caches within the TTL', async () => {
      process.env.CACHE_TTL_SECONDS = '60';
      svc = new IndexService(nansen as unknown as NansenService);
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
      process.env.REBALANCE_THRESHOLD = '0.5';
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
