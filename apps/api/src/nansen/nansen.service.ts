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

@Injectable()
export class NansenService {
  private readonly logger = new Logger(NansenService.name);
  private callCount = 0;
  private successCount = 0;
  private lastError: string | null = null;

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
}
