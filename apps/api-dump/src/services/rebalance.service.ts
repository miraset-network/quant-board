import { RebalanceSignal, Token } from '@quant-board/shared'
import { indexService } from './index.service'
import { calculateWeight, normalizeWeights, sortByWeight } from '../analytics/weight.calculator'

class RebalanceService {
  private readonly THRESHOLD = Number(process.env.REBALANCE_THRESHOLD || 0.05)

  async generateSignal(): Promise<RebalanceSignal> {
    const current = await indexService.getCurrent()
    const currentTokens = current.tokens.slice(0, 10)

    const targetTokens = currentTokens.map(t => ({
      ...t,
      weight: calculateWeight(t),
    }))

    const normalizedTarget = normalizeWeights(targetTokens)
    const sortedTarget = sortByWeight(normalizedTarget)

    const actions = this.calculateActions(currentTokens, sortedTarget)
    const drift = this.calculateDrift(currentTokens, sortedTarget)
    const confidence = this.calculateConfidence(drift)

    return {
      signalDate: new Date().toISOString(),
      currentPortfolio: currentTokens,
      targetPortfolio: sortedTarget,
      actions,
      confidence,
      drift,
    }
  }

  private calculateActions(
    current: Token[],
    target: Token[]
  ): RebalanceSignal['actions'] {
    return target.map((t, i) => {
      const currentToken = current.find(c => c.symbol === t.symbol)
      const currentWeight = currentToken?.weight || 0
      const targetWeight = t.weight
      const diff = targetWeight - currentWeight

      let action: 'BUY' | 'SELL' | 'HOLD'
      if (Math.abs(diff) < 0.5) {
        action = 'HOLD'
      } else if (diff > 0) {
        action = 'BUY'
      } else {
        action = 'SELL'
      }

      return {
        action,
        token: t.symbol,
        change: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
        amount: `$${(Math.abs(diff) * 10000).toFixed(0)}`,
      }
    })
  }

  private calculateDrift(current: Token[], target: Token[]): number {
    let maxDrift = 0
    current.forEach(c => {
      const t = target.find(t => t.symbol === c.symbol)
      if (t) {
        const drift = Math.abs(c.weight - t.weight)
        if (drift > maxDrift) maxDrift = drift
      }
    })
    return maxDrift
  }

  private calculateConfidence(drift: number): number {
    return Math.min(0.95, 0.5 + drift * 10)
  }
}

export const rebalanceService = new RebalanceService()