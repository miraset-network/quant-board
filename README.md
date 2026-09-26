# FOMO Indexes

A Nansen-powered smart-money index dashboard built for the Nansen Meridian Buildathon.

- Backend: **NestJS 12** (ESM, port `3001`)
- Frontend: **Next.js 16 + React 19 + Tailwind 4** (port `3000`)
- Data: **Nansen Query API** (Smart Money Netflow, OHLCV, TGM indicators, Wallet Activity, Account)
- Storage: PostgreSQL (optional), Redis (optional), in-memory cache fallback

## Quick start

> Package managers are mixed. The root uses pnpm, but each app was installed with **bun** and has its own `bun.lock`.

```bash
# 1. API
cd apps/api
cp .env.example .env
# edit .env and add NANSEN_API_KEY
bun install
bun run start:dev

# 2. Web (in a new terminal, from repo root)
cd apps/web
cp .env.example .env  # if you need NEXT_PUBLIC_API_URL
bun install
bun run dev
```

Open http://localhost:3000.

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/index/current` | Current index weights + Nansen call stats |
| GET | `/api/index/rebalance` | Rebalance signal (triggered, drift, confidence, actions) |
| GET | `/api/index/token/:chain/:address` | Token details + 30d OHLCV |
| GET | `/api/index/token/:chain/:address/risk` | Nansen Token God Mode risk/reward indicators |
| GET | `/api/arbitrage/opportunities` | Stat-arb pairs from top index tokens |
| GET | `/api/backtest/run?days=30` | Buy-&-hold backtest of current universe |
| GET | `/api/nansen/credits` | Nansen credit balance + call counters |
| GET | `/api/nansen/wallet-activity` | Smart-money wallet activity |

## Environment variables

| Var | Default | Description |
|-----|---------|-------------|
| `NANSEN_API_KEY` | — | Required. Nansen API key. |
| `PORT_API` | `3001` | API listen port. |
| `CACHE_TTL_SECONDS` | `300` | In-memory cache TTL. |
| `REBALANCE_THRESHOLD` | `0.05` | Drift threshold that triggers a rebalance signal. |
| `DATABASE_URL` | — | Optional PostgreSQL connection string. |
| `REDIS_URL` | — | Optional Redis connection string. |
| `MIN_CREDITS_FOR_RISK` | `20` | Skip TGM indicators when remaining credits are below this. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Web → API base URL. |

## Per-app docs

- [`apps/api/AGENTS.md`](./apps/api/AGENTS.md) — backend commands and quirks
- [`apps/web/AGENTS.md`](./apps/web/AGENTS.md) — frontend commands and quirks

## Project structure

```
quant-board/
├── apps/
│   ├── api/         # NestJS backend
│   └── web/         # Next.js dashboard
├── packages/
│   └── shared/      # @quant-board/shared (types, not wired yet)
├── agents/          # Standalone Python tools (outside workspace)
│   ├── daily_smta/
│   └── token_god_mode/
├── .env.example
├── turbo.json       # dev / build / clean only
└── pnpm-workspace.yaml
```

## Historical docs

- `ARCHITECTURE.md`, `PLAN.md`, `IDEA.md` — original Express + Next 14 design, now archived.

## License

MIT — see `LICENSE`.
