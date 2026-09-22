import { Token } from '@quant-board/shared'

interface WeightFactors {
  smartMoneyFlow: number
  correlationScore: number
  liquidityScore: number
  freshnessScore: number
}

/**
 * Calculate final weight for a token based on multiple factors
 */
export function calculateWeight(
  token: Token,
  factors: Partial<WeightFactors> = {}
): number {
  const weights: Required<WeightFactors> = {
    smartMoneyFlow: 0.40,
    correlationScore: 0.30,
    liquidityScore: 0.20,
    freshnessScore: 0.10,
    ...factors,
  }

  const smFlowScore = normalize(token.smartMoneyScore, 0, 100)
  const corrScore = token.correlation
  const liqScore = normalize(token.whaleConcentration, 0, 100)
  const freshScore = normalize(token.smartMoneyScore, 0, 100) * 0.7 + 30

  const rawWeight =
    smFlowScore * weights.smartMoneyFlow +
    corrScore * weights.correlationScore +
    liqScore * weights.liquidityScore +
    freshScore * weights.freshnessScore

  return Math.max(0, Math.min(100, rawWeight))
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50
  return ((value - min) / (max - min)) * 100
}

/**
 * Normalize weights so they sum to 100%
 */
export function normalizeWeights(tokens: Token[]): Token[] {
  const total = tokens.reduce((sum, t) => sum + t.weight, 0)
  if (total === 0) return tokens

  return tokens.map(t => ({
    ...t,
    weight: Number(((t.weight / total) * 100).toFixed(2)),
  }))
}

/**
 * Sort tokens by weight descending
 */
export function sortByWeight(tokens: Token[]): Token[] {
  return [...tokens].sort((a, b) => b.weight - a.weight)
}