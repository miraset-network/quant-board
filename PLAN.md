# FOMO Indexes — План імплементації (1 тиждень)

## Tech Stack
- **Backend**: Node.js + TypeScript + Express
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Monorepo**: pnpm workspaces + Turborepo
- **Data**: Nansen Query API
- **Storage**: PostgreSQL

## Timeline: 22-28 вересня 2026

## Day 1 (Sep 22) — Foundation

### Morning: Monorepo Setup
```bash
# Initialize pnpm workspace
pnpm init
mkdir -p apps/api apps/web packages/shared

# Install backend deps
cd apps/api && pnpm init
pnpm add express dotenv cors helmet zod
pnpm add -D typescript @types/node @types/express tsx nodemon

# Install frontend deps
cd ../web && pnpm init
pnpm add next@14 react react-dom
pnpm add -D typescript @types/react tailwindcss
```

**Tasks**:
- [ ] Створити структуру директорій
- [ ] Налаштувати tsconfig.json
- [ ] Створити .env.example
- [ ] Оновити .gitignore
- [ ] Зробити перший commit

### Afternoon: Nansen Client
**File**: `src/data/nansen.client.ts`

```typescript
class NansenClient {
  private baseUrl = 'https://api.nansen.ai/v1'
  
  async query<T>(endpoint: string, params: object): Promise<T> {
    // Implementation with retry + rate limiting
  }
}
```

**Endpoints**:
- [ ] POST /query/smart-money-flow
- [ ] POST /token-god-mode
- [ ] POST /wallet/activity

**Deliverable**: ✅ NansenClient with working API calls

## Day 2 (Sep 23) — First Endpoint

### Morning: Express API Skeleton
**File**: `src/index.ts`

```typescript
const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/index', indexRoutes)
app.use('/api/arbitrage', arbitrageRoutes)
app.use('/health', healthRoutes)

app.listen(process.env.PORT)
```

**Tasks**:
- [ ] Express app + routes
- [ ] Zod validation schemas
- [ ] Error middleware
- [ ] Logging middleware

### Afternoon: Index Service
**Files**:
- `src/services/index.service.ts`
- `src/api/index.routes.ts`

**Tasks**:
- [ ] GET /api/index/current
- [ ] TokenRepository для in-memory storage
- [ ] Basic response structure
- [ ] Cache layer (5 хв TTL)

**Deliverable**: ✅ GET /api/index/current working with live Nansen data

## Day 3 (Sep 24) — Correlation Engine

### Morning: Correlation Algorithm
**File**: `src/analytics/correlation.ts`

```typescript
function pearsonCorrelation(x: number[], y: number[]): number {
  // Standard Pearson formula
}
```

**Tasks**:
- [ ] Pearson correlation formula
- [ ] Batch processing для 100+ токенів
- [ ] Edge cases (constant values, NaN)

### Afternoon: Weight Calculator
**File**: `src/analytics/weight.calculator.ts`

**Tasks**:
- [ ] Multi-factor scoring (4 metrics)
- [ ] Normalization (0-1 range)
- [ ] Weight validation (sum = 100%)

```typescript
interface WeightFactors {
  smartMoneyFlow: number      // 40% weight
  correlationScore: number    // 30% weight
  liquidityScore: number      // 20% weight
  freshnessScore: number      // 10% weight
}
```

**Deliverable**: ✅ Weight calculator with tests

## Day 4 (Sep 25) — Rebalance Logic

### Morning: Rebalance Service
**File**: `src/services/rebalance.service.ts`

**Logic**:
```typescript
function shouldRebalance(current: Index, target: Index): boolean {
  const drift = calculateDrift(current, target)
  return drift > 0.05  // 5% threshold
}
```

**Tasks**:
- [ ] Drift calculation
- [ ] Action generation (BUY/SELL/HOLD)
- [ ] Confidence scoring
- [ ] GET /api/index/rebalance endpoint

### Afternoon: Tests + Validation
**File**: `src/__tests__/`

**Tasks**:
- [ ] Unit tests для correlation
- [ ] Unit tests для weight calculator
- [ ] Integration test для rebalance flow

**Deliverable**: ✅ GET /api/index/rebalance working

## Day 5 (Sep 26) — Arbitrage Detection

### Morning: Arbitrage Logic
**File**: `src/analytics/arbitrage.detector.ts`

**Algorithm**:
```
1. Compute correlation matrix
2. Find pairs with corr > 0.9
3. Calculate price divergence
4. If |divergence| > threshold → opportunity
```

**Tasks**:
- [ ] Pair detection (high correlation)
- [ ] Divergence calculation
- [ ] Expected return estimation
- [ ] GET /api/arbitrage/opportunities

### Afternoon: PostgreSQL Integration
**File**: `src/infrastructure/database.ts`

**Tasks**:
- [ ] PostgreSQL connection pool
- [ ] Schema migrations
- [ ] Save/load snapshots
- [ ] Historical signals storage

**Deliverable**: ✅ All 3 endpoints working + persistence

## Day 6 (Sep 27) — Frontend + Documentation

### Morning: Next.js Dashboard (TUI Style)
**File**: `apps/web/app/page.tsx`

**Components**:
- [ ] `IndexOverview.tsx` — Total value, weekly change
- [ ] `TokenList.tsx` — Top 20 holdings table
- [ ] `RebalanceSignal.tsx` — Status + actions
- [ ] `ArbitrageTable.tsx` — Opportunities
- [ ] Live clock + API call counter

**Styling**: Tailwind CSS, monospace font (JetBrains Mono), terminal colors

**Tasks**:
- [ ] Setup Next.js 14 App Router
- [ ] Configure Tailwind with custom theme
- [ ] Connect to `/api/index/*` endpoints
- [ ] Auto-refresh every 30s

### Afternoon: README + Recording
**File**: `README.md` (workspace root)

**Structure**:
```markdown
# FOMO Indexes
## What it does
## Architecture diagram
## Quick Start (pnpm i && pnpm dev)
## API Reference
## Dashboard Preview
## Contact
```

**Recording Plan** (no narration):
```
0:00 - Title screen (ASCII art)
0:30 - Dashboard loads with live data
2:00 - Show index movements
3:30 - Click rebalance signal, show actions
5:00 - Switch to arbitrage opportunities
6:30 - Show Nansen API call counter (1,000+)
8:00 - End
```

**Deliverable**: ✅ Recording ready (under 10 min) + Dashboard

## Day 7 (Sep 28) — Submit

### Morning: Final Testing
**Tasks**:
- [ ] Run full E2E test
- [ ] Verify API call counter ≥ 1,000
- [ ] Test demo end-to-end
- [ ] Fix any critical bugs

### Afternoon: Submission
**Tasks**:
- [ ] Take screenshots for X post
- [ ] Write X post text + tags
- [ ] Submit form at https://nsn.ai/meridian-submit
- [ ] Confirm submission

**Deliverable**: ✅ Submitted to hackathon

## API Calls Milestone

| Day | Target API Calls | Cumulative |
|-----|------------------|------------|
| 1   | 100              | 100        |
| 2   | 200              | 300        |
| 3   | 200              | 500        |
| 4   | 200              | 700        |
| 5   | 200              | 900        |
| 6   | 100              | 1000+ ✅   |
| 7   | -                | -          |

**Strategy**: Use 5 endpoints with rate 1 req / 6 sec = 240/hour easily.

##  Definition of Done

### MVP завершений коли:
- [ ] 3 REST endpoints працюють
- [ ] Live Nansen data зʼявляється
- [ ] API call counter ≥ 1,000
- [ ] Recording < 10 хв без narration
- [ ] README зрозумілий за 5 хв
- [ ] Setup можна зробити за < 10 хв
- [ ] Submission form заповнена

##  Critical Dependencies

```
Nansen API status    → Critical
Node.js v18+         → Required
PostgreSQL доступ    → Required (для persistence)
NPM install          → ~3 min (small deps)
```

##  Risk Mitigation

### Risk 1: Nansen API rate limits
**Mitigation**: Token bucket з jitter, exponential backoff

### Risk 2: Demo recording crash
**Mitigation**: Записати 3 takes, обрати найкращий

### Risk 3: Insufficient API calls
**Mitigation**: Background script на сервері рахує calls автоматично

### Risk 4: Slow development
**Mitigation**: Cut WebSocket з MVP (залишити тільки REST)

##  Post-Hackathon (бонус)

Якщо буде час після MVP:
- [ ] WebSocket для live signals
- [ ] Simple HTML dashboard
- [ ] Backtest historical data
- [ ] Public deploy (Railway/Render)

---

**Start Date**: Sep 22, 2026  
**End Date**: Sep 28, 2026  
**Effort**: ~6-8 годин/день  
**Status**: Ready to start ✅
