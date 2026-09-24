# FOMO Indexes — Архітектура системи (Monorepo)

##  System Overview

```
┌────────────────────────────────────────────────────────────────┐
│              NEXT.JS DASHBOARD (TUI Style)                     │
│         app/  components/  lib/api.ts                          │
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTP (fetch)
                             ↓
┌────────────────────────────────────────────────────────────────┐
│                     EXPRESS API (Backend)                       │
│          /api/index/*  /api/arbitrage/*                        │
└────────────────────────────┬───────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ↓                    ↓                    ↓
┌───────────────┐   ┌────────────────┐   ┌────────────────┐
│  Nansen API   │   │ Analytics Core │   │   Signals DB   │
│    Client     │   │     Engine     │   │  (PostgreSQL)  │
└───────┬───────┘   └────────┬───────┘   └────────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ↓
                   ┌───────────────────┐
                   │  Scheduler (cron) │
                   └───────────────────┘
```

##  Monorepo Structure

```
quant-board/
├── apps/
│   ├── api/                    # Backend (Express + TS)
│   └── web/                    # Frontend (Next.js 14 + TS)
├── packages/
│   └── shared/                 # Shared TS types
├── package.json                # Workspace root
└── turbo.json                  # Turborepo pipeline
```

##  System Overview

```
┌────────────────────────────────────────────────────────────────┐
│                      CLIENT (UI / CLI / X Bot)                 │
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTP / WebSocket
                             ↓
┌────────────────────────────────────────────────────────────────┐
│                     EXPRESS API GATEWAY                         │
│                    /api/index/*  /api/arbitrage/*               │
└────────────────────────────┬───────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ↓                    ↓                    ↓
┌───────────────┐   ┌────────────────┐   ┌────────────────┐
│  Nansen API   │   │ Analytics Core │   │   Signals DB   │
│    Client     │   │     Engine     │   │  (PostgreSQL)  │
└───────┬───────┘   └────────┬───────┘   └────────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ↓
                   ┌───────────────────┐
                   │  Scheduler (cron) │
                   └───────────────────┘
```

##  Архітектурні шари

### 1. API Layer (Express)
**Відповідальність**: REST endpoints, request validation, response formatting.

```typescript
// src/api/index.ts
GET  /api/index/current      → Поточні ваги індексу
GET  /api/index/rebalance    → Сигнали на ребаланс  
GET  /api/arbitrage/opp      → Арбітражні можливості
POST /api/index/simulate     → Backtest симуляція
GET  /health                 → Health check
```

### 2. Service Layer (Business Logic)
**Відповідальність**: Координація між data fetching, analytics та persistence.

```typescript
// src/services/
IndexService         // Управляє станом індексу
ArbitrageService     // Пошук арбітражних пар
CorrelationService   // Розрахунок кореляцій
RebalanceService     // Генерація сигналів ребалансу
```

### 3. Data Layer (Nansen Integration)
**Відповідальність**: Запити до Nansen API, caching, rate limiting.

```typescript
// src/data/
NansenClient         // HTTP клієнт до Nansen
TokenRepository      // Кеш токенів та метрик
WalletRepository     // Дані гаманців
CorrelationCache     // Кеш correlation matrix
```

### 4. Analytics Layer
**Відповідальність**: Чиста бізнес-логіка, обчислення.

```typescript
// src/analytics/
WeightCalculator     // Розрахунок ваг на основі метрик
ArbitrageDetector    // Пошук статичних арбітражів
CorrelationMatrix    // Correlation calculations
RiskScorer           // CEX exposure, whale concentration
```

### 5. Infrastructure Layer
**Відповідальність**: Scheduler, logging, persistence.

```typescript
// src/infrastructure/
Scheduler            // cron-like, періодичні задачі
Logger               // structured logging
Database             // PostgreSQL connection
```

##  Data Flow

### Index Update Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Scheduler тригерить IndexUpdateService               │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 2. NansenClient отримує Smart Money flow (top 20)     │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Analytics Engine розраховує ваги + correlations     │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 4. IndexService зберігає стан в PostgreSQL             │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Cache оновлюється для швидких запитів              │
└─────────────────────────────────────────────────────────┘
```

### Rebalance Signal Flow

```
GET /api/index/rebalance
         ↓
  IndexService.getLatest()
         ↓
  ┌──────────────────────────┐
  │  Чи є новий сигнал?     │
  └──────┬─────────────┬─────┘
         │ YES          │ NO
         ↓              ↓
   Return signal    Return 204
```

##  Модульна структура

```
src/
├── api/                    # HTTP routes
│   ├── index.routes.ts     # /api/index/*
│   ├── arbitrage.routes.ts # /api/arbitrage/*
│   └── health.routes.ts    # /health
│
├── services/               # Business logic
│   ├── index.service.ts
│   ├── arbitrage.service.ts
│   ├── correlation.service.ts
│   └── rebalance.service.ts
│
├── data/                   # Data access
│   ├── nansen.client.ts
│   ├── token.repository.ts
│   └── wallet.repository.ts
│
├── analytics/              # Pure computation
│   ├── weight.calculator.ts
│   ├── arbitrage.detector.ts
│   ├── correlation.ts
│   └── risk.scorer.ts
│
├── infrastructure/         # Cross-cutting
│   ├── scheduler.ts
│   ├── logger.ts
│   └── database.ts
│
├── types/                  # TypeScript types
│   ├── token.ts
│   ├── nansen.ts
│   └── index.ts
│
├── config/                 # Configuration
│   └── env.ts
│
└── index.ts                # Entry point
```

##  Key Design Decisions

### Decision 1: In-Memory Cache + PostgreSQL
**Why**: Швидкі читання + persistence для історії сигналів.

```typescript
class HybridStorage {
  memory: Map<string, IndexState>  // Hot data (latest)
  postgres: Pool                    // Historical signals
}
```

### Decision 2: Single-tenant (MVP)
**Why**: Для хакатону немає потреби в мульти-юзер логіці. Індекс — єдиний.

### Decision 3: Polling-based updates
**Why**: Nansen API не має WebSocket → cron кожні 5 хв для оновлення стану.

```typescript
scheduler.schedule('*/5 * * * *', updateIndexState)
```

### Decision 4: Weighted Multi-Factor Scoring
**Why**: Різні метрики мають різну вагу для визначення фінальної ваги токену.

```
Final Weight = 0.4 × SmartMoneyFlow + 0.3 × Correlation + 0.3 × Liquidity
```

##  Database Schema (PostgreSQL)

```sql
-- Index snapshots (історія ваг)
CREATE TABLE index_snapshots (
  id            SERIAL PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL,
  total_value   NUMERIC,
  weekly_change NUMERIC,
  data          JSONB NOT NULL
);

-- Rebalance signals
CREATE TABLE rebalance_signals (
  id            SERIAL PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL,
  actions       JSONB NOT NULL,
  confidence    NUMERIC,
  executed      BOOLEAN DEFAULT FALSE
);

-- Arbitrage opportunities
CREATE TABLE arbitrage_opportunities (
  id            SERIAL PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL,
  pair          VARCHAR(20),
  correlation   NUMERIC,
  divergence    NUMERIC,
  expected_return NUMERIC
);

-- API call counter (для 1K milestone)
CREATE TABLE api_calls (
  id            SERIAL PRIMARY KEY,
  endpoint      VARCHAR(100),
  timestamp     TIMESTAMPTZ DEFAULT NOW(),
  response_time INTEGER
);
```

##  Environment Configuration

```bash
# .env
NANSEN_API_KEY=nsn_xxx...
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/token_god
CACHE_TTL_SECONDS=300
REBALANCE_THRESHOLD=0.05
```

##  Error Handling Strategy

### Three-tier error response:

```typescript
// 1. Client errors (400): invalid input
{ error: "INVALID_TOKEN", message: "..." }

// 2. External API errors (502): Nansen down
{ error: "UPSTREAM_UNAVAILABLE", retryAfter: 30 }

// 3. Internal errors (500): unexpected
{ error: "INTERNAL", traceId: "uuid" }
```

##  Performance Considerations

| Операція | Очікуваний час | Кешування |
|----------|----------------|-----------|
| GET /index/current | < 100ms | In-memory (5 хв TTL) |
| GET /index/rebalance | < 200ms | In-memory (5 хв TTL) |
| Correlation calc | ~30s | PostgreSQL (daily) |
| Arbitrage scan | ~5s | In-memory (live) |

##  Security

1. **API Key**: зберігати в `.env`, ніколи не комітити
2. **Rate Limiting**: token bucket для Nansen API (60 req/min)
3. **Input Validation**: Zod schemas для всіх endpoints
4. **CORS**: open для MVP (хакатон)

##  Monitoring (MVP)

- Request count per endpoint
- Nansen API call counter (track 1K milestone)
- Response time percentiles
- Error rate by endpoint
- Last successful rebalance timestamp

---

**Build Status**: Architecture Defined  
**Next Step**: Implementation per [PLAN.md](./PLAN.md)
