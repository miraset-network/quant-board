import { Token } from '@quant-board/shared'

interface WalletRecord {
  address: string
  pnl: number
  winRate: number
  tokenPositions: Record<string, number>
}

class WalletRepository {
  private cache: Map<string, WalletRecord> = new Map()

  set(wallets: WalletRecord[]): void {
    wallets.forEach(w => this.cache.set(w.address, w))
  }

  get(address: string): WalletRecord | undefined {
    return this.cache.get(address)
  }

  getAll(): WalletRecord[] {
    return Array.from(this.cache.values())
  }

  getPositions(): Record<string, number> {
    const positions: Record<string, number> = {}
    this.getAll().forEach(w => {
      Object.entries(w.tokenPositions).forEach(([token, amount]) => {
        positions[token] = (positions[token] || 0) + amount
      })
    })
    return positions
  }
}

export const walletRepository = new WalletRepository()