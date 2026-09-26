import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { NansenService } from './../src/nansen/nansen.service.js';

class StubNansen {
  fail = false;
  flow: any = {
    tokens: [
      { symbol: 'ETH', smart_money_score: 95, whale_concentration: 50 },
      { symbol: 'SOL', smart_money_score: 85, whale_concentration: 40 },
      { symbol: 'ARB', smart_money_score: 75, whale_concentration: 30 },
      { symbol: 'OP', smart_money_score: 65, whale_concentration: 25 },
      { symbol: 'MATIC', smart_money_score: 60, whale_concentration: 20 },
      { symbol: 'AVAX', smart_money_score: 55, whale_concentration: 18 },
      { symbol: 'LINK', smart_money_score: 50, whale_concentration: 15 },
      { symbol: 'UNI', smart_money_score: 45, whale_concentration: 12 },
      { symbol: 'AAVE', smart_money_score: 40, whale_concentration: 10 },
      { symbol: 'CRV', smart_money_score: 38, whale_concentration: 8 },
      { symbol: 'MKR', smart_money_score: 36, whale_concentration: 7 },
      { symbol: 'SNX', smart_money_score: 34, whale_concentration: 6 },
    ],
  };
  counter = 0;
  getSmartMoneyFlow = async (_limit: number) => {
    this.counter++;
    if (this.fail) throw new Error('nansen stub failure');
    return this.flow;
  };
  getCallCount = () => this.counter;
  getTopWallets = async () => ({});
  getTokenGodMode = async (_t: string) => ({});
}

describe('API e2e', () => {
  let app: INestApplication<App>;
  let nansen: StubNansen;

  beforeEach(async () => {
    process.env.CACHE_TTL_SECONDS = '0';
    nansen = new StubNansen();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NansenService)
      .useValue(nansen)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /', () => {
    it('returns hello', () => {
      return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
    });
  });

  describe('GET /api/index/current', () => {
    it('returns the index contract shape', async () => {
      const res = await request(app.getHttpServer()).get('/api/index/current').expect(200);
      expect(res.body.indexName).toBe('Top 20 Smart Money Inflow');
      expect(typeof res.body.lastUpdate).toBe('string');
      expect(Array.isArray(res.body.tokens)).toBe(true);
      expect(res.body.tokens.length).toBe(12);
      expect(typeof res.body.apiCalls).toBe('number');
    });

    it('normalises token weights to ~100', async () => {
      const res = await request(app.getHttpServer()).get('/api/index/current').expect(200);
      const sum = res.body.tokens.reduce((s: number, t: any) => s + t.weight, 0);
      expect(sum).toBeGreaterThan(99);
      expect(sum).toBeLessThan(101);
    });

    it('sorts tokens by weight descending', async () => {
      const res = await request(app.getHttpServer()).get('/api/index/current').expect(200);
      const w = res.body.tokens.map((t: any) => t.weight);
      for (let i = 1; i < w.length; i++) {
        expect(w[i - 1]).toBeGreaterThanOrEqual(w[i]);
      }
    });

    it('falls back to hardcoded tokens when Nansen throws', async () => {
      nansen.fail = true;
      const res = await request(app.getHttpServer()).get('/api/index/current').expect(200);
      const symbols = res.body.tokens.map((t: any) => t.symbol);
      expect(symbols.slice(0, 5)).toEqual(['ETH', 'ARB', 'OP', 'SOL', 'MATIC']);
    });
  });

  describe('GET /api/index/rebalance', () => {
    it('returns the rebalance contract shape', async () => {
      const res = await request(app.getHttpServer()).get('/api/index/rebalance').expect(200);
      expect(typeof res.body.signalDate).toBe('string');
      expect(typeof res.body.triggered).toBe('boolean');
      expect(typeof res.body.drift).toBe('number');
      expect(typeof res.body.confidence).toBe('number');
      expect(Array.isArray(res.body.actions)).toBe(true);
      expect(res.body.actions.length).toBeGreaterThan(0);
    });

    it('produces non-zero diffs in actions (Bug 1 regression)', async () => {
      const res = await request(app.getHttpServer()).get('/api/index/rebalance').expect(200);
      const diffs = res.body.actions.map((a: any) => parseFloat(a.change));
      expect(diffs.some((d: number) => d !== 0)).toBe(true);
      expect(res.body.drift).toBeGreaterThan(0);
    });

    it('action labels match diff signs', async () => {
      const res = await request(app.getHttpServer()).get('/api/index/rebalance').expect(200);
      for (const a of res.body.actions) {
        const d = parseFloat(a.change);
        if (Math.abs(d) < 0.5) expect(a.action).toBe('HOLD');
        else if (d > 0) expect(a.action).toBe('BUY');
        else expect(a.action).toBe('SELL');
      }
    });

    it('confidence stays within [0, 0.95]', async () => {
      const res = await request(app.getHttpServer()).get('/api/index/rebalance').expect(200);
      expect(res.body.confidence).toBeGreaterThanOrEqual(0);
      expect(res.body.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe('GET /api/arbitrage/opportunities', () => {
    it('returns the arb contract shape (Bug 3 discriminator)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/arbitrage/opportunities')
        .expect(200);
      expect(Array.isArray(res.body.opportunities)).toBe(true);
      expect(['ok', 'no-threshold-match', 'nansen-empty']).toContain(res.body.status);
    });

    it('returns the arb discriminator from the synthetic series', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/arbitrage/opportunities')
        .expect(200);
      expect(['ok', 'no-threshold-match', 'nansen-empty']).toContain(res.body.status);
      expect(Array.isArray(res.body.opportunities)).toBe(true);
    });

    it('returns status "nansen-empty" when the index has no tokens', async () => {
      nansen.flow = { tokens: [] };
      const res = await request(app.getHttpServer())
        .get('/api/arbitrage/opportunities')
        .expect(200);
      expect(res.body.status).toBe('nansen-empty');
      expect(res.body.opportunities).toEqual([]);
    });
  });
});
