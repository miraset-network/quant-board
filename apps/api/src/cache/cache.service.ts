import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfigShape } from '../config/config.js';

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private memory = new Map<string, MemoryEntry>();
  private readonly memorySweepMs = 60_000;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfigShape) {
    if (cfg.redis.url) {
      try {
        this.redis = new Redis(cfg.redis.url, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
          enableOfflineQueue: false,
        });
        this.redis.on('error', (err: Error) => {
          this.logger.warn(`redis error: ${err.message}`);
        });
        this.redis.connect().catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`redis connect failed, falling back to memory: ${msg}`);
          this.redis?.disconnect();
          this.redis = null;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`redis init failed, using memory: ${msg}`);
        this.redis = null;
      }
    }
    this.sweepTimer = setInterval(() => this.sweepMemory(), this.memorySweepMs);
    this.sweepTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        /* noop */
      }
    }
  }

  private sweepMemory() {
    const now = Date.now();
    for (const [k, v] of this.memory) {
      if (v.expiresAt <= now) this.memory.delete(k);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch {
        /* fall through to memory */
      }
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const json = JSON.stringify(value);
    if (this.redis) {
      try {
        await this.redis.set(key, json, 'EX', Math.max(1, Math.floor(ttlSeconds)));
        return;
      } catch {
        /* fall through to memory */
      }
    }
    this.memory.set(key, { value: json, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.memory.delete(key);
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch {
        /* noop */
      }
    }
  }

  isRedisConnected(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }
}
