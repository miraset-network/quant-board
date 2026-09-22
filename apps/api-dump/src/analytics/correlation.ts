/**
 * Calculate Pearson correlation coefficient between two arrays
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0

  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const meanX = sumX / n
  const meanY = sumY / n

  let numerator = 0
  let denomX = 0
  let denomY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denominator = Math.sqrt(denomX * denomY)
  if (denominator === 0) return 0

  return numerator / denominator
}

/**
 * Build correlation matrix from price history data
 */
export function buildCorrelationMatrix(
  tokens: string[],
  priceHistory: Record<string, number[]>
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {}

  tokens.forEach((tokenA) => {
    matrix[tokenA] = {}
    tokens.forEach((tokenB) => {
      if (tokenA === tokenB) {
        matrix[tokenA][tokenB] = 1
      } else {
        matrix[tokenA][tokenB] = pearsonCorrelation(
          priceHistory[tokenA] || [],
          priceHistory[tokenB] || []
        )
      }
    })
  })

  return matrix
}

/**
 * Find high-correlation pairs (potential arbitrage)
 */
export function findHighCorrelationPairs(
  tokens: string[],
  matrix: Record<string, Record<string, number>>,
  threshold = 0.85
): Array<{ tokenA: string; tokenB: string; correlation: number }> {
  const pairs: Array<{ tokenA: string; tokenB: string; correlation: number }> = []
  const seen = new Set<string>()

  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i]
      const b = tokens[j]
      const corr = matrix[a]?.[b] || 0

      if (corr >= threshold) {
        const key = [a, b].sort().join('/')
        if (!seen.has(key)) {
          seen.add(key)
          pairs.push({ tokenA: a, tokenB: b, correlation: corr })
        }
      }
    }
  }

  return pairs.sort((a, b) => b.correlation - a.correlation)
}