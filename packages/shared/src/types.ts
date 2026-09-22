export interface Token {
  symbol: string
  weight: number
  smartMoneyScore: number
  correlation: number
  whaleConcentration: number
  priceChange24h?: number
}

export interface IndexState {
  indexName: string
  lastUpdate: string
  totalValue: string
  weeklyChange: string
  tokens: Token[]
}

export interface RebalanceSignal {
  signalDate: string
  currentPortfolio: Token[]
  targetPortfolio: Token[]
  actions: Array<{
    action: 'BUY' | 'SELL' | 'HOLD'
    token: string
    change: string
    amount: string
  }>
  confidence: number
  drift: number
}

export interface ArbitrageOpportunity {
  pair: string
  tokenA: string
  tokenB: string
  correlation: number
  divergence: number
  signal: 'LONG_A_SHORT_B' | 'SHORT_A_LONG_B' | 'PAIR_TRADE'
  expectedReturn: string
}

export interface ApiCallStats {
  total: number
  endpoints: Record<string, number>
  lastUpdated: string
}