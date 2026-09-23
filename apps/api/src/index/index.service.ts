import { Injectable } from '@nestjs/common';
import { NansenService } from '../nansen/nansen.service.js';
import { calcWeight, normalizeWeights, TokenWeight } from './index.analytics.js';

@Injectable()
export class IndexService {
  private cache: { data: any; at: number } | null = null;
  private readonly ttl = Number(process.env.CACHE_TTL_SECONDS ?? 300) * 1000;
  constructor(private readonly nansen: NansenService) {}

  async current() {
    if (this.cache && Date.now() - this.cache.at < this.ttl) return this.cache.data;
    let tokens: TokenWeight[];
    try {
      const flow: any = await this.nansen.getSmartMoneyFlow(20);
      tokens = (flow.tokens ?? []).map((t: any) => ({
        symbol: t.symbol ?? t.token_symbol ?? 'UNKNOWN',
        weight: 0,
        smartMoneyScore: t.smart_money_score ?? 50,
        correlation: 0.85,
        whaleConcentration: t.whale_concentration ?? 20,
      }));
    } catch {
      tokens = ['ETH', 'ARB', 'OP', 'SOL', 'MATIC'].map((s, i) => ({
        symbol: s,
        weight: 0,
        smartMoneyScore: 90 - i * 5,
        correlation: 0.9 - i * 0.03,
        whaleConcentration: 35 - i * 3,
      }));
    }
    const weighted = normalizeWeights(
      tokens.map((t) => ({ ...t, weight: calcWeight(t) })),
    ).sort((a, b) => b.weight - a.weight);
    const data = {
      indexName: 'Top 20 Smart Money Inflow',
      lastUpdate: new Date().toISOString(),
      tokens: weighted,
      apiCalls: this.nansen.getCallCount(),
    };
    this.cache = { data, at: Date.now() };
    return data;
  }

  async rebalance() {
    const { tokens } = await this.current();
    const threshold = Number(process.env.REBALANCE_THRESHOLD ?? 0.05);
    const current = tokens.slice(0, 10);
    const target = normalizeWeights(current.map((t: TokenWeight) => ({ ...t, weight: calcWeight(t) })));
    const actions = target.map((t) => {
      const c = current.find((x: TokenWeight) => x.symbol === t.symbol);
      const diff = t.weight - (c?.weight ?? 0);
      return {
        action: Math.abs(diff) < 0.5 ? 'HOLD' : diff > 0 ? 'BUY' : 'SELL',
        token: t.symbol,
        change: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
      };
    });
    const drift = Math.max(...target.map((t, i) => Math.abs(t.weight - (current[i]?.weight ?? 0))));
    return {
      signalDate: new Date().toISOString(),
      triggered: drift / 100 > threshold,
      drift: Number(drift.toFixed(2)),
      confidence: Number(Math.min(0.95, 0.5 + drift / 10).toFixed(2)),
      actions,
    };
  }
}
