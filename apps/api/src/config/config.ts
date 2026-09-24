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
    endpoints: { smartMoneyFlow: string; topWallets: string; tokenGodMode: string };
    defaults: {
      smartMoneyFlowLimit: number;
      topWalletsChain: string;
      topWalletsLimit: number;
      requestTimeoutMs: number;
    };
  };
  index: {
    name: string;
    topN: number;
    scoring: {
      smartMoneyWeight: number;
      correlationWeight: number;
      whaleConcentrationWeight: number;
      smartMoneyBonusWeight: number;
      smartMoneyBonusScale: number;
      smartMoneyBonusBias: number;
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
    fallbackTokens: FallbackToken[];
    messages: {
      nansenEmpty: string;
      nansenError: string;
      fallbackUsed: string;
    };
  };
  arbitrage: {
    topN: number;
    synthetic: {
      points: number;
      base: number;
      stepPerToken: number;
      stepPerBar: number;
      noiseAmplitude: number;
      noiseFreq: number;
    };
  };
  thresholds: {
    rebalance: number;
    arbCorr: number;
    arbDiv: number;
  };
  cache: { ttlSeconds: number };
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
    port: num(process.env.PORT_API ?? process.env.PORT, 3001, 'PORT_API'),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
