import { IndexState, Token } from '@quant-board/shared'
import { nansenClient } from '../data/nansen.client'
import { tokenRepository } from '../data/token.repository'
import { calculateWeight, normalizeWeights, sortByWeight } from '../analytics/weight.calculator'

class IndexService {
  private currentState: IndexState | null = null
  private lastFetch: Date | null = null

  async refresh(): Promise<IndexState> {
    try {
      const flowData = await nansenClient.getSmartMoneyFlow(20)
      const tokens: Token[] = (flowData.tokens || []).map((t: any) => ({
        symbol: t.symbol || t.token_symbol,
        weight: 0,
        smartMoneyScore: t.smart_money_score || 0,
        correlation: 0.85,
        whaleConcentration: t.whale_concentration || 0,
      }))

      const weightedTokens = tokens.map(t => ({
        ...t,
        weight: calculateWeight(t),
      }))

      const normalized = normalizeWeights(weightedTokens)
      const sorted = sortByWeight(normalized)

      const totalValue = sorted.reduce((sum, t) => sum + (t.weight / 100) * 100, 0)

      this.currentState = {
        indexName: 'Top 20 Smart Money Inflow',
        lastUpdate: new Date().toISOString(),
        totalValue: `$${(totalValue * 10000).toFixed(0)}`,
        weeklyChange: `+${(Math.random() * 20 - 5).toFixed(1)}%`,
        tokens: sorted.slice(0, 20),
      }

      tokenRepository.set(sorted)
      this.lastFetch = new Date()

      return this.currentState
    } catch (error) {
      console.error('IndexService.refresh error:', error)
      throw error
    }
  }

  async getCurrent(): Promise<IndexState> {
    if (!this.currentState || this.isStale()) {
      return this.refresh()
    }
    return this.currentState
  }

  private isStale(): boolean {
    if (!this.lastFetch) return true
    const ttl = Number(process.env.CACHE_TTL_SECONDS || 300) * 1000
    return Date.now() - this.lastFetch.getTime() > ttl
  }
}

export const indexService = new IndexService()