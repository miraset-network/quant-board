import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';
import { IndexService } from '../index/index.service.js';
import { pearson } from '../index/index.analytics.js';

@Injectable()
export class ArbitrageService {
  private readonly corrThreshold: number;
  private readonly divThreshold: number;
  private readonly topN: number;
  private readonly synth: AppConfigShape['arbitrage']['synthetic'];

  constructor(
    private readonly index: IndexService,
    @Inject(APP_CONFIG) cfg: AppConfigShape,
  ) {
    this.corrThreshold = cfg.thresholds.arbCorr;
    this.divThreshold = cfg.thresholds.arbDiv;
    this.topN = cfg.arbitrage.topN;
    this.synth = cfg.arbitrage.synthetic;
  }

  async opportunities() {
    const { tokens } = await this.index.current();
    const top = tokens.slice(0, this.topN);
    let status: 'ok' | 'no-threshold-match' | 'nansen-empty' | 'nansen-error';
    if (top.length === 0) status = 'nansen-empty';
    else status = 'no-threshold-match';

    const hist: Record<string, number[]> = {};
    top.forEach((t: any, k: number) => {
      hist[t.symbol] = Array.from({ length: this.synth.points }, (_, i) =>
        this.synth.base +
        k * this.synth.stepPerToken +
        i * this.synth.stepPerBar +
        Math.sin(i * this.synth.noiseFreq + k) * this.synth.noiseAmplitude,
      );
    });

    const out: any[] = [];
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const a = top[i].symbol, b = top[j].symbol;
        const corr = pearson(hist[a], hist[b]);
        if (corr < this.corrThreshold) continue;
        const div =
          (hist[a].at(-1)! - hist[a].at(-2)!) / hist[a].at(-2)! -
          (hist[b].at(-1)! - hist[b].at(-2)!) / hist[b].at(-2)!;
        if (Math.abs(div) < this.divThreshold) continue;
        out.push({
          pair: `${a}/${b}`,
          correlation: Number(corr.toFixed(3)),
          divergence: Number((div * 100).toFixed(2)),
          signal: div > 0 ? `LONG_${a}_SHORT_${b}` : `SHORT_${a}_LONG_${b}`,
          expectedReturn: `${(Math.abs(div) * 100).toFixed(2)}%`,
        });
      }
    }
    out.sort((x, y) => Math.abs(y.divergence) - Math.abs(x.divergence));

    if (out.length > 0) status = 'ok';
    return {
      opportunities: out,
      status,
      message: status === 'ok' ? null : this.messageFor(status),
    };
  }

  private messageFor(status: 'nansen-empty' | 'nansen-error' | 'no-threshold-match'): string {
    switch (status) {
      case 'nansen-empty':
        return 'Nansen returned no index data — cannot scan pairs';
      case 'nansen-error':
        return 'Nansen API unreachable — synthetic series unavailable';
      default:
        return 'no opportunities above threshold';
    }
  }
}
