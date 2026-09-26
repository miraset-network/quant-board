import {
  type ArbitrageResult,
  type BacktestResult,
  type IndexState,
  type NansenCreditsResponse,
  type RebalanceSignal,
  type TokenDetails,
  type TokenRisk,
  type WalletActivityResponse,
} from '@quant-board/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as T;
}

export const api = {
  index: () => get<IndexState>('/api/index/current'),
  rebalance: () => get<RebalanceSignal>('/api/index/rebalance'),
  arbitrage: () => get<ArbitrageResult>('/api/arbitrage/opportunities'),
  credits: () => get<NansenCreditsResponse>('/api/nansen/credits'),
  backtest: (days = 30) => get<BacktestResult>(`/api/backtest/run?days=${days}`),
  token: (chain: string, address: string, days = 30) =>
    get<TokenDetails>(`/api/index/token/${chain}/${address}?days=${days}`),
  tokenRisk: (chain: string, address: string) =>
    get<TokenRisk>(`/api/index/token/${chain}/${address}/risk`),
  walletActivity: (chain?: string) =>
    get<WalletActivityResponse>(`/api/nansen/wallet-activity${chain ? `?chain=${chain}` : ''}`),
};

// Re-export shared types so consumers can keep importing from `lib/api`.
export type {
  ArbitrageResult as Arbitrage,
  ArbitrageOpportunity,
  BacktestResult as Backtest,
  BacktestPoint,
  BacktestLeg,
  CreditSnapshot,
  IndexState,
  IndexStatus,
  NansenCreditsResponse,
  RebalanceSignal as Rebalance,
  RebalanceAction,
  Token,
  TokenDetails,
  TokenPricePoint,
  TokenRisk,
  TokenRiskIndicator,
  WalletActivityResponse,
  WalletActivityRow,
} from '@quant-board/shared';
