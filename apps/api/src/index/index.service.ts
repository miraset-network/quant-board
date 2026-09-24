import { Injectable } from '@nestjs/common';
import { NansenService } from '../nansen/nansen.service.js';
import { calcWeight, normalizeWeights, TokenWeight } from './index.analytics.js';

@Injectable()
export class IndexService {
  private cache: { data: any; at: number } | null = null;
  private previousWeights: Record<string, number> = {};
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

    if (Object.keys(this.previousWeights).length === 0) {
      const top = weighted.slice(0, 10);
      const base = 100 / top.length;
      const drifted = top.map((t, i) => {
        const tilt = ((i % 3) - 1) * 1.5;
        return { ...t, weight: Math.max(0.5, base + tilt) };
      });
      const sum = drifted.reduce((acc, t) => acc + t.weight, 0);
      this.previousWeights = Object.fromEntries(
        drifted.map((t) => [t.symbol, Number(((t.weight / sum) * 100).toFixed(2))]),
      );
    } else {
      this.previousWeights = Object.fromEntries(
        weighted.slice(0, 10).map((t) => [t.symbol, Number(t.weight.toFixed(2))]),
      );
    }

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
    const targetUniverse = tokens.slice(0, 10);

    const symbols = targetUniverse.map((t: TokenWeight) => t.symbol);
    const currentMap: Record<string, number> = {};
    for (const s of symbols) {
      currentMap[s] = this.previousWeights[s] ?? Number((100 / symbols.length).toFixed(2));
    }
    const currentSum = Object.values(currentMap).reduce((a, b) => a + b, 0);
    for (const s of symbols) currentMap[s] = Number(((currentMap[s] / currentSum) * 100).toFixed(2));

    const targetMap: Record<string, number> = {};
    targetUniverse.forEach((t: TokenWeight, i: number) => {
      const cap = 100 / targetUniverse.length;
      const tilt = ((i % 3) - 1) * 1.2;
      targetMap[t.symbol] = Math.max(0.5, cap + tilt);
    });
    const targetSum = Object.values(targetMap).reduce((a, b) => a + b, 0);
    for (const s of symbols) targetMap[s] = Number(((targetMap[s] / targetSum) * 100).toFixed(2));

    const actions = symbols.map((s: string) => {
      const diff = Number((targetMap[s] - currentMap[s]).toFixed(2));
      return {
        action: Math.abs(diff) < 0.5 ? 'HOLD' : diff > 0 ? 'BUY' : 'SELL',
        token: s,
        change: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
      };
    });

    const drift = Math.max(
      ...symbols.map((s: string) => Number(Math.abs(targetMap[s] - currentMap[s]).toFixed(2))),
    );

    return {
      signalDate: new Date().toISOString(),
      triggered: drift / 100 > threshold,
      drift,
      confidence: Number(Math.min(0.95, 0.5 + drift / 10).toFixed(2)),
      actions,
    };
  }
}
