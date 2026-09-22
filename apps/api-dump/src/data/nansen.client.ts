import 'dotenv/config'

export interface NansenQueryParams {
  tokens?: string[]
  limit?: number
  chain?: string
  timeframe?: string
}

class NansenClient {
  private baseUrl = 'https://api.nansen.ai/v1'
  private apiKey: string
  private callCount = 0

  constructor() {
    this.apiKey = process.env.NANSEN_API_KEY || ''
  }

  async query<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    this.callCount++
    const url = new URL(`${this.baseUrl}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value))
      }
    })

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Nansen API error: ${response.status} ${response.statusText}`)
    }

    return response.json() as T
  }

  async getSmartMoneyFlow(limit = 20): Promise<any> {
    return this.query('/smart-money/flow', { limit, order_by: 'net_inflow', order: 'desc' })
  }

  async getTokenGodMode(token: string): Promise<any> {
    return this.query(`/token-god-mode/${token}`)
  }

  async getWalletActivity(wallet: string): Promise<any> {
    return this.query(`/wallet/${wallet}/activity`)
  }

  async getTopWallets(chain = 'ethereum', limit = 10): Promise<any> {
    return this.query('/smart-money/top-wallets', { chain, limit })
  }

  getCallCount(): number {
    return this.callCount
  }
}

export const nansenClient = new NansenClient()