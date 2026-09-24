import { describe, it, expect } from 'vitest';
import { calcWeight, normalizeWeights, pearson, TokenWeight } from './index.analytics.js';

const sample = (over: Partial<TokenWeight> = {}): TokenWeight => ({
  symbol: 'ETH',
  weight: 0,
  smartMoneyScore: 80,
  correlation: 0.9,
  whaleConcentration: 30,
  ...over,
});

describe('pearson', () => {
  it('returns 0 for empty arrays', () => {
    expect(pearson([], [])).toBe(0);
  });

  it('returns 0 for mismatched lengths', () => {
    expect(pearson([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 1 for perfectly correlated series', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearson(x, y)).toBeCloseTo(1, 6);
  });

  it('returns -1 for perfectly anti-correlated series', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [5, 4, 3, 2, 1];
    expect(pearson(x, y)).toBeCloseTo(-1, 6);
  });

  it('returns 0 for zero variance', () => {
    expect(pearson([5, 5, 5], [5, 5, 5])).toBe(0);
  });
});

describe('calcWeight', () => {
  it('is monotonic in smartMoneyScore', () => {
    const low = calcWeight(sample({ smartMoneyScore: 20 }));
    const high = calcWeight(sample({ smartMoneyScore: 95 }));
    expect(high).toBeGreaterThan(low);
  });

  it('clamps into [0, 100]', () => {
    const min = calcWeight(sample({ smartMoneyScore: 0, correlation: 0, whaleConcentration: 0 }));
    const max = calcWeight(sample({ smartMoneyScore: 100, correlation: 1, whaleConcentration: 100 }));
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(100);
  });
});

describe('normalizeWeights', () => {
  it('renormalises weights to sum to 100', () => {
    const out = normalizeWeights([
      sample({ symbol: 'A', weight: 1 }),
      sample({ symbol: 'B', weight: 1 }),
      sample({ symbol: 'C', weight: 1 }),
    ]);
    const sum = out.reduce((s, t) => s + t.weight, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it('returns input unchanged when total is zero', () => {
    const tokens = [sample({ symbol: 'A', weight: 0 }), sample({ symbol: 'B', weight: 0 })];
    expect(normalizeWeights(tokens)).toBe(tokens);
  });

  it('preserves symbol and other fields', () => {
    const out = normalizeWeights([sample({ symbol: 'ARB', weight: 2, smartMoneyScore: 70 })]);
    expect(out[0].symbol).toBe('ARB');
    expect(out[0].smartMoneyScore).toBe(70);
  });
});
