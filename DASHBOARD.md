# Dashboard Structure — FOMO Indexes

Live at `apps/web/components/Dashboard.tsx` (client component, polls 3 endpoints every 30 s and backtest every 5 m).

## Layout (5 panels)

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER                                                            │
│   FOMO INDEXES                       [LIVE] ⚡ <UTC clock>   │
├──────────────────────────────────────────┬───────────────────────┤
│ PANEL 1 · INDEX STATUS                   │ PANEL 2 · REBALANCE   │
│                                          │   SIGNAL              │
├──────────────────────────────────────────┼───────────────────────┤
│ PANEL 3 · TOP HOLDINGS (table)           │ PANEL 4 · BACKTEST    │
│                                          │                       │
├──────────────────────────────────────────┴───────────────────────┤
│ PANEL 5 · ARBITRAGE OPPORTUNITIES                                  │
├──────────────────────────────────────────────────────────────────┤
│ FOOTER ⟳ auto-refresh 30s (backtest 5m) · backend: :3001 · Nansen-powered │
└──────────────────────────────────────────────────────────────────┘
```

## Field map — UI vs API vs IDEA.md

| UI row                         | API field                | Source file                  | Notes                                   |
|--------------------------------|--------------------------|------------------------------|-------------------------------------------------|
| **INDEX STATUS**               |                          |                              |                                                 |
| `Name:`                        | `indexName`              | `index/index.service.ts:113`  |                                                 |
| `Updated:`                     | `lastUpdate` (ISO)       | `index/index.service.ts:114`  |                                                 |
| `Nansen API calls:`            | `successfulCalls / apiCalls` | `index/index.service.ts:116-117` | hackathon KPI (target ≥ 1 000)           |
| `Credits left:`                | `credits.totalRemaining` | `index/index.service.ts:122`  | from Nansen response headers / account endpoint |
| **REBALANCE SIGNAL**           |                          |                              |                                                 |
| `Status:` ● TRIGGERED / ○ HOLD | `triggered: boolean`     | `index/index.service.ts:334`  | replaces old `currentPortfolio`/`targetPortfolio` shape |
| `Drift:`                       | `drift: number`          | `index/index.service.ts:335`  |                                                 |
| `Confidence:`                  | `confidence: number`     | `index/index.service.ts:337`  |                                                 |
| Action rows (`HOLD ETH 0.0%`)  | `actions[]`              | `index/index.service.ts:339`  |                                                  |
| **TOP HOLDINGS table**         |                          |                              |                                                 |
| `#`, `TOKEN`, `WEIGHT`, `SM`, `CORR`, `WHALE%` | `tokens[]` | `index/index.service.ts:115`  | API returns topN from config; UI slices first 10 (`Dashboard.tsx:226`) |
| **BACKTEST**                   |                          |                              |                                                 |
| Return / NAV / max DD / series | `backtest.*`             | `backtest/backtest.service.ts` | polled every 5 minutes (`Dashboard.tsx:128`)    |
| **ARBITRAGE OPPORTUNITIES**    |                          |                              |                                                 |
| `PAIR / CORR / DIV% / SIGNAL / EST` | `opportunities[]`   | `arbitrage/arbitrage.service.ts` | enriched with z-score, half-life, hedge notionals |

## ⚠️ Notes

### Rebalance action drift

Earlier versions of `rebalance` derived `current` and `target` from the same weighted array, which made every action collapse to `HOLD 0.0%`. The current implementation keeps a `previousWeights` history and computes drift against it (`index/index.service.ts:280-341`).

### Arbitrage status discriminator

`arbitrage.service.ts` now returns a `status` field (`ok`, `no-threshold-match`, `nansen-empty`, `nansen-error`) and a `message`, so the dashboard can distinguish "no signal" from upstream failures (`arbitrage/arbitrage.service.ts:82-199`).

## Endpoint contract (as actually served today)

```
GET /api/index/current
  → { indexName, lastUpdate, tokens:[{symbol,weight,smartMoneyScore,correlation,whaleConcentration,...}], apiCalls, successfulCalls, status, message, credits }

GET /api/index/rebalance
  → { signalDate, triggered, drift, confidence, actions:[{action,token,change}] }

GET /api/index/token/:chain/:address?days=30
  → { chain, address, days, windowStart, windowEnd, symbol, weight, smartMoneyScore, correlation,
      whaleConcentration, marketCapUsd, netflow24hUsd, netflow7dUsd, netflow30dUsd, traderCount,
      tokenAgeDays, sectors, price, changePct, series:[{date,open,high,low,close,volumeUsd}], ohlcvError, generatedAt }

GET /api/index/token/:chain/:address/risk
  → { chain, address, skipped, cached, reason?, error?, tokenInfo, riskIndicators[], rewardIndicators[], generatedAt }

GET /api/arbitrage/opportunities
  → { opportunities:[{pair,correlation,divergence,signal,expectedReturn,candlesUsed,beta,zScore,
      halfLifeDays,halfLifeOk,spreadMean,spreadStd,notionalRatio,hedgeNotionals,exitTarget}],
      status, message, apiCalls?, successfulCalls? }

GET /api/backtest/run?days=30
  → { status, message, days, windowStart, windowEnd, universeSize, requestedSize, startNav, endNav,
      returnPct, maxDrawdownPct, bestDay, worstDay, series:[{date,nav}], legs:[{symbol,weight,returnPct,candles}], generatedAt }

GET /api/nansen/credits
  → { includedRemaining, includedLimit, purchasedRemaining, plan, costLastCall, source, updatedAt,
      totalRemaining, apiCalls, successfulCalls, lastError }

GET /api/nansen/wallet-activity?chain=ethereum
  → { status, data, pagination }
```

`Rebalance` no longer exposes `currentPortfolio` / `targetPortfolio` from the original IDEA.md — only a flat `actions[]`.
