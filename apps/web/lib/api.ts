const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Token {
  symbol: string;
  weight: number;
  smartMoneyScore: number;
  correlation: number;
  whaleConcentration: number;
}

export interface IndexState {
  indexName: string;
  lastUpdate: string;
  tokens: Token[];
  apiCalls: number;
}

export interface Rebalance {
  signalDate: string;
  triggered: boolean;
  drift: number;
  confidence: number;
  actions: { action: string; token: string; change: string }[];
}

export interface Arbitrage {
  opportunities: {
    pair: string;
    correlation: number;
    divergence: number;
    signal: string;
    expectedReturn: string;
  }[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as T;
}

export const api = {
  index: () => get<IndexState>('/api/index/current'),
  rebalance: () => get<Rebalance>('/api/index/rebalance'),
  arbitrage: () => get<Arbitrage>('/api/arbitrage/opportunities'),
};
