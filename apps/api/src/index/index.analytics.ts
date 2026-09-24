export interface ScoringWeights {
  netflowWeight: number;
  traderCountWeight: number;
  marketCapWeight: number;
  scoreScaleUsd: number;
  traderCountScale: number;
  marketCapScaleUsd: number;
}

export interface TokenWeight {
  symbol: string;
  weight: number;
  smartMoneyScore: number;
  correlation: number;
  whaleConcentration: number;
}

export const DEFAULT_SCORING: ScoringWeights = {
  netflowWeight: 0.5,
  traderCountWeight: 0.3,
  marketCapWeight: 0.2,
  scoreScaleUsd: 100000,
  traderCountScale: 100,
  marketCapScaleUsd: 1_000_000_000,
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
  const wh = t.whaleConcentration / 100;
  const corr = t.correlation;
  const raw = sm * scoring.netflowWeight + wh * scoring.traderCountWeight + corr * scoring.marketCapWeight;
  return Math.max(0, Math.min(100, raw * 100));
}

export function normalizeWeights(tokens: TokenWeight[]): TokenWeight[] {
  const total = tokens.reduce((s, t) => s + t.weight, 0);
  if (!total) return tokens;
  return tokens.map((t) => ({ ...t, weight: Number(((t.weight / total) * 100).toFixed(2)) }));
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export interface OlsResult {
  beta: number;
  alpha: number;
  residuals: number[];
}

export function olsRegression(y: number[], x: number[]): OlsResult {
  const n = Math.min(y.length, x.length);
  if (n < 2) return { beta: 0, alpha: 0, residuals: [] };
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
  }
  const beta = dx === 0 ? 0 : num / dx;
  const alpha = my - beta * mx;
  const residuals = Array.from<number>({ length: n });
  for (let i = 0; i < n; i++) residuals[i] = y[i] - (alpha + beta * x[i]);
  return { beta, alpha, residuals };
}

export function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (values[i] - mean) ** 2;
  const std = Math.sqrt(v / Math.max(1, n - 1));
  return { mean, std };
}

export function toLogPrices(closes: number[]): number[] {
  const out: number[] = [];
  for (const c of closes) {
    if (typeof c !== 'number' || !Number.isFinite(c) || c <= 0) {
      out.push(Number.NaN);
    } else {
      out.push(Math.log(c));
    }
  }
  return out;
}

export interface SpreadStats {
  beta: number;
  alpha: number;
  spread: number[];
  mean: number;
  std: number;
  zScore: number;
  latestLogA: number;
  latestLogB: number;
  candlesUsed: number;
}

export function buildLogSpread(logA: number[], logB: number[]): SpreadStats | null {
  const len = Math.min(logA.length, logB.length);
  if (len < 3) return null;
  const a = logA.slice(logA.length - len);
  const b = logB.slice(logB.length - len);
  if (a.some((v) => !Number.isFinite(v)) || b.some((v) => !Number.isFinite(v))) return null;
  const { beta, alpha, residuals } = olsRegression(a, b);
  const { mean, std } = meanStd(residuals);
  if (!Number.isFinite(std) || std === 0) return null;
  const zScore = (residuals[residuals.length - 1] - mean) / std;
  return {
    beta,
    alpha,
    spread: residuals,
    mean,
    std,
    zScore,
    latestLogA: a[a.length - 1],
    latestLogB: b[b.length - 1],
    candlesUsed: len,
  };
}

export function halfLifeOfMeanReversion(series: number[]): number {
  const n = series.length;
  if (n < 3) return Number.POSITIVE_INFINITY;
  const y = series.slice(1);
  const x = series.slice(0, -1);
  const dy = Array.from<number>({ length: n - 1 });
  for (let i = 0; i < n - 1; i++) dy[i] = y[i] - x[i];
  const { beta } = olsRegression(dy, x);
  if (!Number.isFinite(beta) || beta >= 0) return Number.POSITIVE_INFINITY;
  const phi = 1 + beta;
  if (phi <= 0 || phi >= 1) return Number.POSITIVE_INFINITY;
  return -Math.log(2) / Math.log(phi);
}
