import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NansenService {
  private readonly logger = new Logger(NansenService.name);
  private readonly baseUrl = 'https://api.nansen.ai/v1';
  private callCount = 0;

  private get apiKey(): string {
    return process.env.NANSEN_API_KEY ?? '';
  }

  private async query<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    this.callCount++;
    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
    }
    this.logger.debug(`Nansen #${this.callCount} → ${url.pathname}`);
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Nansen API ${res.status}: ${res.statusText}`);
    return res.json() as T;
  }

  getSmartMoneyFlow(limit = 20) {
    return this.query('/smart-money/flow', { limit, order_by: 'net_inflow', order: 'desc' });
  }

  getTopWallets(chain = 'ethereum', limit = 10) {
    return this.query('/smart-money/top-wallets', { chain, limit });
  }

  getTokenGodMode(token: string) {
    return this.query(`/token-god-mode/${token}`);
  }

  getCallCount(): number {
    return this.callCount;
  }
}
