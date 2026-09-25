import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export interface FallbackToken {
  symbol: string;
  smartMoneyScore: number;
  correlation: number;
  whaleConcentration: number;
}

export interface AppConfigShape {
  nansen: {
    baseUrl: string;
    apiKey: string;
    endpoints: { smartMoneyNetflow: string; tokenOhlcv: string; account: string };
    defaults: {
      requestTimeoutMs: number;
      smartMoneyChains: string[];
      smartMoneyPerPage: number;
      smartMoneyPage: number;
      ohlcvTimeframe: string;
      ohlcvLookbackDays: number;
    };
  };
  index: {
    name: string;
    topN: number;
    scoring: {
      netflowWeight: number;
      traderCountWeight: number;
      marketCapWeight: number;
      scoreScaleUsd: number;
      traderCountScale: number;
      marketCapScaleUsd: number;
    };
    rebalance: {
      holdThresholdPct: number;
      initialTiltPct: number;
      targetTiltPct: number;
      minWeightPct: number;
      confidenceBase: number;
      confidenceDriftFactor: number;
      confidenceCap: number;
    };
    messages: {
      nansenEmpty: string;
      nansenError: string;
    };
  };
  arbitrage: {
    topN: number;
    minCandles: number;
    statArb: {
      zEntryThreshold: number;
      zExitThreshold: number;
      maxHalfLifeDays: number;
      minCorrForCointegration: number;
      minWindow: number;
      maxWindow: number;
    };
  };
  thresholds: {
    rebalance: number;
    arbCorr: number;
    arbDiv: number;
  };
  cache: { ttlSeconds: number };
  redis: { url: string | null };
  indicators: { riskCacheTtlSeconds: number; minCreditsForRisk: number };
  port: number;
}

function findDefaults(): string {
  const candidates: string[] = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, 'defaults.json'));
    candidates.push(resolve(here, '../config/defaults.json'));
    candidates.push(resolve(here, '../../src/config/defaults.json'));
  } catch {
    /* import.meta.url unavailable in some sandboxes */
  }
  candidates.push(resolve(process.cwd(), 'dist/config/defaults.json'));
  candidates.push(resolve(process.cwd(), 'src/config/defaults.json'));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `config: defaults.json not found. Tried:\n  ${candidates.join('\n  ')}`,
  );
}

function loadDefaults(): AppConfigShape {
  const path = findDefaults();
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as AppConfigShape;
}

function num(v: string | undefined, fallback: number, name: string): number {
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`config: ${name} must be a number, got "${v}"`);
  }
  return n;
}

function str(v: string | undefined, fallback: string): string {
  return v === undefined || v === '' ? fallback : v;
}

export function loadConfig(): AppConfigShape {
  const d = loadDefaults();
  return {
    ...d,
    nansen: {
      ...d.nansen,
      apiKey: str(process.env.NANSEN_API_KEY, ''),
    },
    thresholds: {
      rebalance: num(process.env.REBALANCE_THRESHOLD, 0.05, 'REBALANCE_THRESHOLD'),
      arbCorr: num(process.env.ARB_CORR_THRESHOLD, 0.85, 'ARB_CORR_THRESHOLD'),
      arbDiv: num(process.env.ARB_DIV_THRESHOLD, 0.05, 'ARB_DIV_THRESHOLD'),
    },
    cache: { ttlSeconds: num(process.env.CACHE_TTL_SECONDS, 300, 'CACHE_TTL_SECONDS') },
    redis: { url: str(process.env.REDIS_URL, '') || null },
    indicators: {
      riskCacheTtlSeconds: num(process.env.RISK_CACHE_TTL_SECONDS, 86400, 'RISK_CACHE_TTL_SECONDS'),
      minCreditsForRisk: num(process.env.MIN_CREDITS_FOR_RISK, 20, 'MIN_CREDITS_FOR_RISK'),
    },
    port: num(process.env.PORT_API ?? process.env.PORT, 3001, 'PORT_API'),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
