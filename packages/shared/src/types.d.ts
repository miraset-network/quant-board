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
    traderCount?: number;
    tokenAgeDays?: number;
    sectors?: string[];
}
export type IndexStatus = 'ok' | 'nansen-empty' | 'nansen-error';
export interface CreditSnapshot {
    includedRemaining: number | null;
    includedLimit: number | null;
    purchasedRemaining: number | null;
    plan: string | null;
    costLastCall: number | null;
    source: 'headers' | 'account-endpoint' | 'unknown';
    updatedAt: string;
}
export interface IndexState {
    indexName: string;
    lastUpdate: string;
    tokens: Token[];
    apiCalls: number;
    successfulCalls: number;
    status: IndexStatus;
    message: string | null;
    source: 'nansen';
    credits: CreditSnapshot & {
        totalRemaining: number | null;
    };
}
export interface RebalanceAction {
    action: 'BUY' | 'SELL' | 'HOLD';
    token: string;
    change: string;
}
export interface RebalanceSignal {
    signalDate: string;
    triggered: boolean;
    drift: number;
    confidence: number;
    actions: RebalanceAction[];
}
export interface ArbitrageOpportunity {
    pair: string;
    correlation: number;
    divergence: number;
    signal: string;
    expectedReturn: string;
    candlesUsed: number;
    beta: number;
    zScore: number;
    halfLifeDays: number;
    halfLifeOk: boolean;
    spreadMean: number;
    spreadStd: number;
    notionalRatio: string;
    hedgeNotionals: {
        legA: number;
        legB: number;
    };
    exitTarget: number;
}
export type ArbitrageStatus = 'ok' | 'no-threshold-match' | 'nansen-empty' | 'nansen-error';
export interface ArbitrageResult {
    opportunities: ArbitrageOpportunity[];
    status: ArbitrageStatus;
    message: string | null;
    apiCalls?: number;
    successfulCalls?: number;
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
export interface TokenRiskIndicator {
    type: string;
    score: 'low' | 'medium' | 'high' | 'bearish' | 'neutral' | 'bullish' | null;
    signal: number | null;
    percentile: number | null;
    lastTriggerOn: string | null;
}
export interface TokenRisk {
    chain: string;
    address: string;
    skipped: boolean;
    cached: boolean;
    reason?: string;
    error?: string;
    tokenInfo: {
        market_cap_usd?: number;
        market_cap_group?: string;
        is_stablecoin?: boolean;
    } | null;
    riskIndicators: TokenRiskIndicator[] | null;
    rewardIndicators: TokenRiskIndicator[] | null;
    generatedAt?: string;
}
export type BacktestStatus = 'ok' | 'no-data' | 'nansen-error';
export interface BacktestPoint {
    date: string;
    nav: number;
}
export interface BacktestLeg {
    symbol: string;
    weight: number;
    returnPct: number;
    candles: number;
}
export interface BacktestResult {
    status: BacktestStatus;
    message: string | null;
    days: number;
    windowStart: string;
    windowEnd: string;
    universeSize: number;
    requestedSize: number;
    startNav: number;
    endNav: number;
    returnPct: number;
    maxDrawdownPct: number;
    bestDay: {
        date: string;
        pct: number;
    } | null;
    worstDay: {
        date: string;
        pct: number;
    } | null;
    series: BacktestPoint[];
    legs: BacktestLeg[];
    generatedAt: string;
}
export interface WalletActivityRow {
    wallet_address: string;
    chain: string;
    net_flow_usd: number;
    token_symbol?: string;
    token_address?: string;
    transaction_count?: number;
    last_activity?: string;
}
export interface WalletActivityResponse {
    status: 'ok' | 'error';
    data: WalletActivityRow[];
    pagination: {
        page: number;
        per_page: number;
        is_last_page?: boolean;
    } | null;
    message?: string;
}
export interface NansenCreditsResponse extends CreditSnapshot {
    totalRemaining: number | null;
    apiCalls: number;
    successfulCalls: number;
    lastError: string | null;
}
