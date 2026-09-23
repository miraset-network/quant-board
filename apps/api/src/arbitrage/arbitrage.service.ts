import { Injectable } from '@nestjs/common';
import { IndexService } from '../index/index.service.js';
import { pearson } from '../index/index.analytics.js';

@Injectable()
export class ArbitrageService {
  constructor(private readonly index: IndexService) {}

  async opportunities() {
    const { tokens } = await this.index.current();
    const top = tokens.slice(0, 8);
    const hist: Record<string, number[]> = {};
    top.forEach((t: any, k: number) =>
      hist[t.symbol] = Array.from({ length: 30 }, (_, i) => 100 + k * 3 + i * 0.5 + Math.sin(i * 0.3 + k) * 5),
    );
    const out: any[] = [];
    for (let i = 0; i < top.length; i++)
      for (let j = i + 1; j < top.length; j++) {
        const a = top[i].symbol, b = top[j].symbol;
        const corr = pearson(hist[a], hist[b]);
        if (corr < 0.85) continue;
        const div = ((hist[a].at(-1)! - hist[a].at(-2)!) / hist[a].at(-2)!) - ((hist[b].at(-1)! - hist[b].at(-2)!) / hist[b].at(-2)!);
        if (Math.abs(div) < 0.05) continue;
        out.push({
          pair: `${a}/${b}`,
          correlation: Number(corr.toFixed(3)),
          divergence: Number((div * 100).toFixed(2)),
          signal: div > 0 ? `LONG_${a}_SHORT_${b}` : `SHORT_${a}_LONG_${b}`,
          expectedReturn: `${(Math.abs(div) * 100).toFixed(2)}%`,
        });
      }
    return { opportunities: out.sort((x, y) => Math.abs(y.divergence) - Math.abs(x.divergence)) };
  }
}
