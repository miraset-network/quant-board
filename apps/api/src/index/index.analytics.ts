export interface ScoringWeights {
  smartMoneyWeight: number;
  correlationWeight: number;
  whaleConcentrationWeight: number;
  smartMoneyBonusWeight: number;
  smartMoneyBonusScale: number;
  smartMoneyBonusBias: number;
}

export interface TokenWeight {
  symbol: string;
  weight: number;
  smartMoneyScore: number;
  correlation: number;
  whaleConcentration: number;
}

export const DEFAULT_SCORING: ScoringWeights = {
  smartMoneyWeight: 0.4,
  correlationWeight: 0.3,
  whaleConcentrationWeight: 0.2,
  smartMoneyBonusWeight: 0.1,
  smartMoneyBonusScale: 0.7,
  smartMoneyBonusBias: 0.3,
};

export function pearson(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export function calcWeight(t: TokenWeight, scoring: ScoringWeights = DEFAULT_SCORING): number {
  const sm = t.smartMoneyScore / 100;
  const raw =
    sm * scoring.smartMoneyWeight +
    t.correlation * scoring.correlationWeight +
    (t.whaleConcentration / 100) * scoring.whaleConcentrationWeight +
    (sm * scoring.smartMoneyBonusScale + scoring.smartMoneyBonusBias) * scoring.smartMoneyBonusWeight;
  return Math.max(0, Math.min(100, raw * 100));
}

export function normalizeWeights(tokens: TokenWeight[]): TokenWeight[] {
  const total = tokens.reduce((s, t) => s + t.weight, 0);
  if (!total) return tokens;
  return tokens.map((t) => ({ ...t, weight: Number(((t.weight / total) * 100).toFixed(2)) }));
}
