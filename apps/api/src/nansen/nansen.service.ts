import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';

export class NansenError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NansenError';
  }
}

export interface NansenQueryResult<T> {
  data: T;
  empty: boolean;
  error: null | string;
}

@Injectable()
export class NansenService {
  private readonly logger = new Logger(NansenService.name);
  private callCount = 0;
  private lastError: string | null = null;

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfigShape) {}

  getCallCount(): number {
    return this.callCount;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  private async query<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    this.callCount++;
    this.lastError = null;
    const url = new URL(`${this.cfg.nansen.baseUrl}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      const str = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : JSON.stringify(v);
      url.searchParams.append(k, str);
    }
    this.logger.debug(`Nansen #${this.callCount} → ${url.pathname}`);
    if (!this.cfg.nansen.apiKey) {
      const msg = 'NANSEN_API_KEY not set';
      this.lastError = msg;
      throw new NansenError(msg);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.nansen.defaults.requestTimeoutMs);
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.cfg.nansen.apiKey}`,
          'x-api-key': this.cfg.nansen.apiKey,
          'Content-Type': 'application/json',
        },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const msg = `Nansen API ${res.status}: ${res.statusText}`;
        this.lastError = msg;
        throw new NansenError(msg);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (this.lastError === null) {
        this.lastError = err instanceof Error ? err.message : 'unknown error';
      }
      throw new NansenError(this.lastError, err);
    } finally {
      clearTimeout(timer);
    }
  }

  getSmartMoneyFlow(limit = this.cfg.nansen.defaults.smartMoneyFlowLimit): Promise<any> {
    return this.query(this.cfg.nansen.endpoints.smartMoneyFlow, {
      limit,
      order_by: 'net_inflow',
      order: 'desc',
    });
  }

  getTopWallets(
    chain = this.cfg.nansen.defaults.topWalletsChain,
    limit = this.cfg.nansen.defaults.topWalletsLimit,
  ) {
    return this.query(this.cfg.nansen.endpoints.topWallets, { chain, limit });
  }

  getTokenGodMode(token: string) {
    return this.query(`${this.cfg.nansen.endpoints.tokenGodMode}/${token}`);
  }
}
