import { Token } from '@quant-board/shared'

interface TokenRecord {
  symbol: string
  address: string
  netInflow: number
  smartMoneyScore: number
  whaleConcentration: number
}

class TokenRepository {
  private cache: Map<string, Token> = new Map()
  private lastUpdate: Date | null = null

  set(tokens: Token[]): void {
    tokens.forEach(t => this.cache.set(t.symbol, t))
    this.lastUpdate = new Date()
  }

  getAll(): Token[] {
    return Array.from(this.cache.values())
  }

  getBySymbol(symbol: string): Token | undefined {
    return this.cache.get(symbol)
  }

  getTop(n: number): Token[] {
    return this.getAll().slice(0, n)
  }

  getLastUpdate(): Date | null {
    return this.lastUpdate
  }

  size(): number {
    return this.cache.size
  }
}

export const tokenRepository = new TokenRepository()