import { ArbitrageOpportunity, Token } from '@quant-board/shared'
import { findHighCorrelationPairs, buildCorrelationMatrix } from './correlation'

/**
 * Detect static arbitrage opportunities between highly correlated tokens
 */
export function detectArbitrage(
  tokens: Token[],
  priceHistory: Record<string, number[]>
): ArbitrageOpportunity[] {
  const symbols = tokens.map(t => t.symbol)
  const matrix = buildCorrelationMatrix(symbols, priceHistory)
  const pairs = findHighCorrelationPairs(symbols, matrix, 0.85)

  const opportunities: ArbitrageOpportunity[] = []

  pairs.forEach(({ tokenA, tokenB, correlation }) => {
    const pricesA = priceHistory[tokenA] || []
    const pricesB = priceHistory[tokenB] || []

    if (pricesA.length < 2 || pricesB.length < 2) return

    const currentA = pricesA[pricesA.length - 1]
    const currentB = pricesB[pricesB.length - 1]
    const prevA = pricesA[pricesA.length - 2]
    const prevB = pricesB[pricesB.length - 2]

    const returnA = (currentA - prevA) / prevA
    const returnB = (currentB - prevB) / prevB
    const divergence = returnA - returnB

    if (Math.abs(divergence) < 0.05) return

    let signal: 'LONG_A_SHORT_B' | 'SHORT_A_LONG_B' | 'PAIR_TRADE'
    if (divergence > 0) {
      signal = 'LONG_A_SHORT_B'
    } else {
      signal = 'SHORT_A_LONG_B'
    }

    opportunities.push({
      pair: `${tokenA}/${tokenB}`,
      tokenA,
      tokenB,
      correlation,
      divergence: Number((divergence * 100).toFixed(2)),
      signal,
      expectedReturn: `${(Math.abs(divergence) * 100).toFixed(2)}%`,
    })
  })

  return opportunities.sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
}