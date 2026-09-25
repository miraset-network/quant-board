import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';

export class NansenError extends Error {
  constructor(message: string, public readonly status?: number, public readonly cause?: unknown) {
    super(message);
    this.name = 'NansenError';
  }
}

export interface SmartMoneyNetflowRow {
  token_address: string;
  token_symbol: string;
  chain: string;
  net_flow_1h_usd: number;
  net_flow_24h_usd: number;
  net_flow_7d_usd: number;
  net_flow_30d_usd: number;
  trader_count: number;
  token_age_days: number;
  market_cap_usd: number;
  token_sectors?: string[];
}

export interface SmartMoneyNetflowResponse {
  data: SmartMoneyNetflowRow[];
  pagination?: { page: number; per_page: number; is_last_page?: boolean };
}

export interface OhlcvCandle {
  interval_start: string;
  open: number | null;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  volume_usd: number;
  market_cap: { open: number; high: number; low: number; close: number };
}

export interface OhlcvBatchResponse {
  chain: string;
  timeframe: string;
  tokens: { token_address: string; data: OhlcvCandle[] }[];
  truncated?: boolean;
  truncation_note?: string;
}

export interface CreditSnapshot {
  includedRemaining: number | null;
  includedLimit: number | null;
  purchasedRemaining: number | null;
  plan: string | null;
  costLastCall: number | null;
  source: 'headers' | 'account-endpoint' | 'unknown';
  updatedAt: string;
}

export interface TgmIndicator {
  indicator_type: string;
  score?: string;
  signal?: number;
  signal_percentile?: number;
  last_trigger_on?: string;
}

export interface TgmIndicatorsResponse {
  token_address: string;
  chain: string;
  token_info?: {
    market_cap_usd?: number;
    market_cap_group?: string;
    is_stablecoin?: boolean;
  };
  risk_indicators: TgmIndicator[];
  reward_indicators: TgmIndicator[];
}

export interface AccountResponse {
  plan?: string;
  credits?: { included?: { remaining?: number; limit?: number }; purchased?: { remaining?: number } };
}

@Injectable()
export class NansenService {
  private readonly logger = new Logger(NansenService.name);
  private callCount = 0;
  private successCount = 0;
  private lastError: string | null = null;
  private credits: CreditSnapshot = {
    includedRemaining: null,
    includedLimit: null,
    purchasedRemaining: null,
    plan: null,
    costLastCall: null,
    source: 'unknown',
    updatedAt: new Date(0).toISOString(),
  };

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfigShape) {}

  getCallCount(): number {
    return this.callCount;
  }

  getSuccessCount(): number {
    return this.successCount;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getCredits(): CreditSnapshot {
    return { ...this.credits };
  }

  private ingestCreditHeaders(headers: Headers, source: 'headers' | 'account-endpoint') {
    const get = (name: string): string | null => {
      for (const [k, v] of headers.entries()) {
        if (k.toLowerCase() === name.toLowerCase()) return v;
      }
      return null;
    };
    const num = (s: string | null): number | null => {
      if (s === null) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const includedRemaining = num(get('x-credits-remaining')) ?? num(get('x-credit-remaining')) ?? num(get('x-nansen-credits-remaining'));
    const includedLimit = num(get('x-credits-limit')) ?? num(get('x-credit-limit'));
    const purchasedRemaining = num(get('x-credits-purchased-remaining'));
    const costLastCall = num(get('x-credits-cost')) ?? num(get('x-credit-cost'));
    const plan = get('x-nansen-plan') ?? get('x-plan');

    if (
      includedRemaining !== null ||
      includedLimit !== null ||
      purchasedRemaining !== null ||
      costLastCall !== null ||
      plan !== null
    ) {
      this.credits = {
        includedRemaining: includedRemaining ?? this.credits.includedRemaining,
        includedLimit: includedLimit ?? this.credits.includedLimit,
        purchasedRemaining: purchasedRemaining ?? this.credits.purchasedRemaining,
        plan: plan ?? this.credits.plan,
        costLastCall: costLastCall ?? this.credits.costLastCall,
        source,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    this.callCount++;
    this.lastError = null;
    if (!this.cfg.nansen.apiKey) {
      this.callCount--;
      const msg = 'NANSEN_API_KEY not set';
      this.lastError = msg;
      throw new NansenError(msg);
    }
    const url = `${this.cfg.nansen.baseUrl}${path}`;
    this.logger.debug(`Nansen #${this.callCount} POST ${url}`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.nansen.defaults.requestTimeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: this.cfg.nansen.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      this.ingestCreditHeaders(res.headers, 'headers');
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const j = await res.json();
          if (j?.message) detail = String(j.message);
          else if (j?.error) detail = String(j.error);
        } catch {
          /* body not JSON */
        }
        const msg = `Nansen ${res.status} ${detail}`;
        this.lastError = msg;
        throw new NansenError(msg, res.status);
      }
      this.successCount++;
      return (await res.json()) as T;
    } catch (err) {
      if (this.lastError === null) {
        this.lastError = err instanceof Error ? err.message : 'unknown error';
      }
      throw new NansenError(this.lastError, undefined, err);
    } finally {
      clearTimeout(timer);
    }
  }

  async getAccount(): Promise<AccountResponse> {
    const resp = await this.post<AccountResponse>(this.cfg.nansen.endpoints.account, {});
    if (resp?.credits?.included?.remaining !== undefined) {
      const inc = resp.credits.included;
      this.credits = {
        includedRemaining: inc.remaining ?? this.credits.includedRemaining,
        includedLimit: inc.limit ?? this.credits.includedLimit,
        purchasedRemaining: resp.credits.purchased?.remaining ?? this.credits.purchasedRemaining,
        plan: resp.plan ?? this.credits.plan,
        costLastCall: this.credits.costLastCall,
        source: 'account-endpoint',
        updatedAt: new Date().toISOString(),
      };
    }
    return resp;
  }

  async getSmartMoneyNetflow(opts: {
    chains?: string[];
    perPage?: number;
    page?: number;
    orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  } = {}): Promise<SmartMoneyNetflowResponse> {
    const chains = opts.chains ?? this.cfg.nansen.defaults.smartMoneyChains;
    const perPage = opts.perPage ?? this.cfg.nansen.defaults.smartMoneyPerPage;
    const page = opts.page ?? 1;
    const orderBy = opts.orderBy ?? [
      { field: 'net_flow_24h_usd', direction: 'DESC' },
    ];
    return this.post<SmartMoneyNetflowResponse>(this.cfg.nansen.endpoints.smartMoneyNetflow, {
      chains,
      pagination: { page, per_page: perPage },
      order_by: orderBy,
    });
  }

  async getOhlcvBatch(opts: {
    chain: string;
    timeframe?: string;
    tokenAddresses: string[];
    from: string;
    to: string;
  }): Promise<OhlcvBatchResponse> {
    return this.post<OhlcvBatchResponse>(this.cfg.nansen.endpoints.tokenOhlcv, {
      chain: opts.chain,
      timeframe: opts.timeframe ?? this.cfg.nansen.defaults.ohlcvTimeframe,
      token_addresses: opts.tokenAddresses,
      date: { from: opts.from, to: opts.to },
    });
  }

  async getTokenIndicators(chain: string, tokenAddress: string): Promise<TgmIndicatorsResponse> {
    return this.post<TgmIndicatorsResponse>('/tgm/indicators', {
      chain,
      token_address: tokenAddress,
    });
  }
}
