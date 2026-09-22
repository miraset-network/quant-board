import { ArbitrageOpportunity, Token } from '@quant-board/shared'
import { indexService } from './index.service'
import { detectArbitrage } from '../analytics/arbitrage.detector'

class ArbitrageService {
  private cache: ArbitrageOpportunity[] = []
  private lastScan: Date | null = null

  async scan(): Promise<ArbitrageOpportunity[]> {
    const index = await indexService.getCurrent()
    const tokens = index.tokens.slice(0, 10)

    // Mock price history for demo (real would fetch from Nansen)
    const priceHistory = this.generateMockPriceHistory(tokens)

    const opportunities = detectArbitrage(tokens, priceHistory)
    this.cache = opportunities
    this.lastScan = new Date()

    return opportunities
  }

  async getOpportunities(): Promise<ArbitrageOpportunity[]> {
    if (!this.lastScan || this.isStale()) {
      return this.scan()
    }
    return this.cache
  }

  private isStale(): boolean {
    if (!this.lastScan) return true
    return Date.now() - this.lastScan.getTime() > 60000 // 1 min
  }

  private generateMockPriceHistory(tokens: Token[]): Record<string, number[]> {
    const history: Record<string, number[]> = {}
    tokens.forEach(t => {
      history[t.symbol] = Array.from({ length: 30 }, (_, i) => {
        const base = 100 + Math.random() * 50
        const trend = i * 0.5
        return base + trend + Math.sin(i * 0.3) * 5
      })
    })
    return history
  }
}

export const arbitrageService = new ArbitrageService()