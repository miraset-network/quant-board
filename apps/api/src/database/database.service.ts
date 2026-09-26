import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';

interface PgPool {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
  end(): Promise<void>;
}

let PoolClass: (new (opts: Record<string, unknown>) => PgPool) | null = null;

async function loadPg(): Promise<typeof PoolClass> {
  if (PoolClass) return PoolClass;
  const mod = await import('pg');
  PoolClass = (mod.default ?? mod).Pool as unknown as typeof PoolClass;
  return PoolClass;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: PgPool | null = null;
  private readonly url: string | null;

  constructor(@Inject(APP_CONFIG) cfg: AppConfigShape) {
    this.url = cfg.database?.url || process.env.DATABASE_URL || null;
  }

  get enabled(): boolean {
    return this.url !== null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.url) {
      this.logger.log('DATABASE_URL not set — persistence disabled (in-memory only)');
      return;
    }
    try {
      const PgPool = await loadPg();
      this.pool = new PgPool!({
        connectionString: this.url,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
      await this.migrate();
      this.logger.log('PostgreSQL connected and migrated');
    } catch (err) {
      this.logger.warn(`PostgreSQL unavailable: ${err instanceof Error ? err.message : err} — running without persistence`);
      this.pool = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  private async migrate(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS index_snapshots (
        id         SERIAL PRIMARY KEY,
        timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        data       JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rebalance_signals (
        id         SERIAL PRIMARY KEY,
        timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actions    JSONB NOT NULL,
        drift      NUMERIC,
        confidence NUMERIC,
        triggered  BOOLEAN DEFAULT FALSE
      );
      CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
        id         SERIAL PRIMARY KEY,
        timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        pair       VARCHAR(40),
        data       JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS api_call_log (
        id         SERIAL PRIMARY KEY,
        endpoint   VARCHAR(200),
        success    BOOLEAN,
        timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_api_call_log_ts ON api_call_log (timestamp);
      CREATE INDEX IF NOT EXISTS idx_index_snapshots_ts ON index_snapshots (timestamp);
    `);
  }

  async saveIndexSnapshot(data: unknown): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        'INSERT INTO index_snapshots (data) VALUES ($1)',
        [JSON.stringify(data)],
      );
    } catch (err) {
      this.logger.warn(`saveIndexSnapshot failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async saveRebalanceSignal(signal: {
    actions: unknown;
    drift: number;
    confidence: number;
    triggered: boolean;
  }): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        'INSERT INTO rebalance_signals (actions, drift, confidence, triggered) VALUES ($1, $2, $3, $4)',
        [JSON.stringify(signal.actions), signal.drift, signal.confidence, signal.triggered],
      );
    } catch (err) {
      this.logger.warn(`saveRebalanceSignal failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async saveArbitrageOpportunities(opportunities: unknown[]): Promise<void> {
    if (!this.pool) return;
    try {
      for (const opp of opportunities) {
        const o = opp as { pair?: string };
        await this.pool.query(
          'INSERT INTO arbitrage_opportunities (pair, data) VALUES ($1, $2)',
          [o.pair ?? 'unknown', JSON.stringify(opp)],
        );
      }
    } catch (err) {
      this.logger.warn(`saveArbitrageOpportunities failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async logApiCall(endpoint: string, success: boolean): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        'INSERT INTO api_call_log (endpoint, success) VALUES ($1, $2)',
        [endpoint, success],
      );
    } catch {
      /* silent — logging must never break the app */
    }
  }

  async getPersistedCallCount(): Promise<number> {
    if (!this.pool) return 0;
    try {
      const { rows } = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*)::int AS count FROM api_call_log',
      );
      return Number(rows[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }

  async getLatestIndexSnapshot<T>(): Promise<T | null> {
    if (!this.pool) return null;
    try {
      const { rows } = await this.pool.query<{ data: T }>(
        'SELECT data FROM index_snapshots ORDER BY timestamp DESC LIMIT 1',
      );
      return rows[0]?.data ?? null;
    } catch {
      return null;
    }
  }
}
