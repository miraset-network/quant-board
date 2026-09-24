import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArbitrageService } from './arbitrage.service.js';
import { IndexService } from '../index/index.service.js';

function fakeIndex(tokens: { symbol: string; weight: number }[]): Partial<IndexService> {
  return {
    current: vi.fn(async () => ({ tokens } as any)),
  };
}

describe('ArbitrageService', () => {
  let svc: ArbitrageService;

  beforeEach(() => {
    process.env.CACHE_TTL_SECONDS = '0';
    delete process.env.ARB_CORR_THRESHOLD;
    delete process.env.ARB_DIV_THRESHOLD;
  });

  it('returns status "ok" when pairs clear the configured thresholds', async () => {
    process.env.ARB_CORR_THRESHOLD = '0';
    process.env.ARB_DIV_THRESHOLD = '0';
    const tokens = Array.from({ length: 12 }, (_, i) => ({ symbol: `T${i}`, weight: 100 / 12 }));
    svc = new ArbitrageService(fakeIndex(tokens) as IndexService);
    const out = await svc.opportunities();
    expect(out.opportunities.length).toBeGreaterThan(0);
    expect(out.status).toBe('ok');
  });

  it('returns status "no-threshold-match" when thresholds are unreachable', async () => {
    process.env.ARB_CORR_THRESHOLD = '1.5';
    process.env.ARB_DIV_THRESHOLD = '100';
    const tokens = Array.from({ length: 12 }, (_, i) => ({ symbol: `T${i}`, weight: 100 / 12 }));
    svc = new ArbitrageService(fakeIndex(tokens) as IndexService);
    const out = await svc.opportunities();
    expect(out.status).toBe('no-threshold-match');
    expect(out.opportunities).toEqual([]);
  });

  it('returns status "nansen-empty" when no tokens come back', async () => {
    svc = new ArbitrageService(fakeIndex([]) as IndexService);
    const out = await svc.opportunities();
    expect(out.status).toBe('nansen-empty');
    expect(out.opportunities).toEqual([]);
  });

  it('sorts opportunities by absolute divergence descending', async () => {
    const tokens = Array.from({ length: 6 }, (_, i) => ({ symbol: `T${i}`, weight: 100 / 6 }));
    svc = new ArbitrageService(fakeIndex(tokens) as IndexService);
    const out = await svc.opportunities();
    const abs = out.opportunities.map((o) => Math.abs(o.divergence));
    for (let i = 1; i < abs.length; i++) {
      expect(abs[i - 1]).toBeGreaterThanOrEqual(abs[i]);
    }
  });

  it('emits the correct signal direction (long/short) based on divergence sign', async () => {
    const tokens = [{ symbol: 'ETH', weight: 50 }, { symbol: 'SOL', weight: 50 }];
    svc = new ArbitrageService(fakeIndex(tokens) as IndexService);
    const out = await svc.opportunities();
    if (out.opportunities.length === 0) return;
    const o = out.opportunities[0];
    const [a, b] = o.pair.split('/');
    if (o.divergence > 0) {
      expect(o.signal).toBe(`LONG_${a}_SHORT_${b}`);
    } else {
      expect(o.signal).toBe(`SHORT_${a}_LONG_${b}`);
    }
  });
});
