# Dashboard Structure — FOMO Indexes

Live at `apps/web/components/Dashboard.tsx` (client component, polls 3 endpoints every 30 s).

## Layout (4 panels, 2×2 grid)

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER                                                            │
│   FOMO INDEXES                       [LIVE] ⚡ <UTC clock>   │
├──────────────────────────────────────────┬───────────────────────┤
│ PANEL 1 · INDEX STATUS                   │ PANEL 2 · REBALANCE   │
│                                          │   SIGNAL              │
│                                          │                       │
├──────────────────────────────────────────┼───────────────────────┤
│ PANEL 3 · TOP HOLDINGS (table)           │ PANEL 4 · ARBITRAGE   │
│                                          │   OPPORTUNITIES       │
├──────────────────────────────────────────┴───────────────────────┤
│ FOOTER ⟳ auto-refresh 30s · backend: :3001 · Nansen-powered       │
└──────────────────────────────────────────────────────────────────┘
```

## Field map — UI vs API vs IDEA.md

| UI row                         | API field                | Source file                  | IDEA.md says                                   |
|--------------------------------|--------------------------|------------------------------|-------------------------------------------------|
| **INDEX STATUS**               |                          |                              |                                                 |
| `Name:`                        | `indexName`              | `index/index.service.ts:36`  | ✅ matches                                       |
| `Updated:`                     | `lastUpdate` (ISO)       | `index/index.service.ts:37`  | ✅ matches                                       |
| `Nansen API calls:`            | `apiCalls`               | `index/index.service.ts:39`  | ⚠️ not in IDEA; hackathon KPI (target ≥ 1 000)   |
| **REBALANCE SIGNAL**           |                          |                              |                                                 |
| `Status:` ● TRIGGERED / ○ HOLD | `triggered: boolean`     | `index/index.service.ts:62`  | ❌ IDEA shows `actions` array, not a flag        |
| `Drift:`                       | `drift: number`          | `index/index.service.ts:63`  | ❌ IDEA has no `drift` — it has `currentPortfolio` vs `targetPortfolio` |
| `Confidence:`                  | `confidence: number`     | `index/index.service.ts:64`  | ✅ matches                                       |
| Action rows (`HOLD ETH 0.0%`)  | `actions[]`              | `index/index.service.ts:53`  | ✅ but always "HOLD 0.0%" in practice (see ⚠️ Bug 1) |
| **TOP HOLDINGS table**         |                          |                              |                                                 |
| `#`, `TOKEN`, `WEIGHT`, `SM`, `CORR`, `WHALE%` | `tokens[]` | `index/index.service.ts:38`  | IDEA calls these `top 20`; UI slices first 10 (`Dashboard.tsx:82`) |
| **ARBITRAGE OPPORTUNITIES**    |                          |                              |                                                 |
| `PAIR / CORR / DIV% / SIGNAL / EST` | `opportunities[]`   | `arbitrage/arbitrage.service.ts` | ✅ matches IDEA shape                           |

## ⚠️ Bugs (visible in the screenshot you pasted)

### Bug 1 — Every rebalance action shows `HOLD <TOKEN> 0.0%`

`index.service.ts:46-58` recomputes `target` from the **same** `current` tokens:

```ts
const current = tokens.slice(0, 10);          // already weighted
const target  = normalizeWeights(current.map(t => ({...t, weight: calcWeight(t)})));
const diff    = t.weight - (c?.weight ?? 0);  // always 0
```

`current` and `target` are derived from the same array → `diff === 0` for every row → action collapses to `HOLD 0.0%`. The "rebalance" endpoint never actually proposes a trade.

### Bug 2 — TOP HOLDINGS shows the hardcoded fallback

Screenshot: 5 rows (ETH, ARB, OP, SOL, MATIC), all `weight ≈ 18-22%`, no `24h`-style metric. That matches the fallback branch in `index.service.ts:24-31`, which fires when `nansen.getSmartMoneyFlow()` throws. `apiCalls: 6` (6 hits over the whole demo, not the 1 000+ the hackathon requires) confirms Nansen isn't being exercised.

### Bug 3 — Empty arbitrage panel is silent

`Dashboard.tsx:113` shows `no opportunities above threshold —` when `arb.opportunities.length === 0`. The `arbitrage.service.ts` returns an empty array on success, so the UI can't tell apart "Nansen returned nothing" from "no signal above threshold".

## Quick-fix pointers (one-liner each)

- **Bug 1** — pick a different source for `current` (e.g. last cached portfolio before re-weights) or compare against a *target* derived from a different heuristic (e.g. cap any weight > `1/N + threshold`).
- **Bug 2** — set `NANSEN_API_KEY` in `.env`, or wire `agents/daily_smta` / `agents/token_god_mode` to seed real Nansen data into `index.service.ts`. The two `agents/*` folders are listed in AGENTS.md as standalone Python tools — `daily_smta` likely already drives `getSmartMoneyFlow`.
- **Bug 3** — return a `{ status: 'no-threshold-match' | 'nansen-empty' | 'ok' }` discriminator from `arbitrage.service.ts`.

## Endpoint contract (as actually served today)

```
GET /api/index/current
  → { indexName, lastUpdate, tokens:[{symbol,weight,smartMoneyScore,correlation,whaleConcentration}], apiCalls }

GET /api/index/rebalance
  → { signalDate, triggered, drift, confidence, actions:[{action,token,change}] }

GET /api/arbitrage/opportunities
  → { opportunities:[{pair,correlation,divergence,signal,expectedReturn}] }
```

⚠️ `Rebalance` no longer exposes `currentPortfolio` / `targetPortfolio` from IDEA.md — only a flat `actions[]`. If the demo relies on showing the before/after portfolio, the API needs to be extended.
