const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Token {
  symbol: string;
  weight: number;
  smartMoneyScore: number;
  correlation: number;
  whaleConcentration: number;
  tokenAddress?: string;
  chain?: string;
  marketCapUsd?: number;
  netflow24hUsd?: number;
  netflow7dUsd?: number;
  netflow30dUsd?: number;
}

export interface TokenPricePoint {
  date: string;
  open: number | null;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
}

export interface TokenDetails {
  chain: string;
  address: string;
  days: number;
  windowStart: string;
  windowEnd: string;
  symbol: string | null;
  weight: number | null;
  smartMoneyScore: number | null;
  correlation: number | null;
  whaleConcentration: number | null;
  marketCapUsd: number | null;
  netflow24hUsd: number | null;
  netflow7dUsd: number | null;
  netflow30dUsd: number | null;
  traderCount: number | null;
  tokenAgeDays: number | null;
  sectors: string[];
  price: number | null;
  changePct: number | null;
  series: TokenPricePoint[];
  ohlcvError: string | null;
  generatedAt: string;
}

export interface IndexCredits {
  includedRemaining: number | null;
  includedLimit: number | null;
  purchasedRemaining: number | null;
  plan: string | null;
  costLastCall: number | null;
  source: 'headers' | 'account-endpoint' | 'unknown';
  updatedAt: string;
  totalRemaining: number | null;
}

export interface IndexState {
  indexName: string;
  lastUpdate: string;
  tokens: Token[];
  apiCalls: number;
  successfulCalls: number;
  status: 'ok' | 'nansen-empty' | 'nansen-error';
  source: 'nansen';
  message?: string | null;
  credits?: IndexCredits;
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
    candlesUsed?: number;
    beta?: number;
    zScore?: number;
    halfLifeDays?: number;
    halfLifeOk?: boolean;
    spreadMean?: number;
    spreadStd?: number;
    notionalRatio?: string;
    hedgeNotionals?: { legA: number; legB: number };
    exitTarget?: number;
  }[];
  status: 'ok' | 'no-threshold-match' | 'nansen-empty' | 'nansen-error';
  message?: string | null;
  apiCalls?: number;
  successfulCalls?: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as T;
}

export interface BacktestLeg {
  symbol: string;
  weight: number;
  returnPct: number;
  candles: number;
}

export interface BacktestPoint {
  date: string;
  nav: number;
}

export interface Backtest {
  status: 'ok' | 'no-data' | 'nansen-error';
  message?: string | null;
  days: number;
  windowStart: string;
  windowEnd: string;
  universeSize: number;
  requestedSize: number;
  startNav: number;
  endNav: number;
  returnPct: number;
  maxDrawdownPct: number;
  bestDay: { date: string; pct: number } | null;
  worstDay: { date: string; pct: number } | null;
  series: BacktestPoint[];
  legs: BacktestLeg[];
  generatedAt: string;
}

export const api = {
  index: () => get<IndexState>('/api/index/current'),
  rebalance: () => get<Rebalance>('/api/index/rebalance'),
  arbitrage: () => get<Arbitrage>('/api/arbitrage/opportunities'),
  credits: () => get<IndexCredits & { apiCalls: number; successfulCalls: number; lastError: string | null }>('/api/nansen/credits'),
  backtest: (days = 30) => get<Backtest>(`/api/backtest/run?days=${days}`),
  token: (chain: string, address: string, days = 30) =>
    get<TokenDetails>(`/api/index/token/${chain}/${address}?days=${days}`),
};
