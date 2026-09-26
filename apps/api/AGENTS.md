# apps/api — NestJS backend

## Commands (run from `apps/api`)

- dev watch: `bun run start:dev`
- unit tests: `bun run test` (vitest; matches `**/*.spec.ts` via `vitest.config.ts`)
- e2e: `bun run test:e2e` (separate config `vitest.config.e2e.ts`; matches `**/*.e2e-spec.ts`)
- lint: `bun run lint` — **oxlint** (type-aware), not eslint
- format: `bun run format` (prettier: single quotes, trailing commas — see `.prettierrc`)
- no typecheck script; `bun run build` (`nest build`) surfaces TS errors

## Module layout (entry: `src/main.ts` → `src/app.module.ts`)

- `src/index/` — `GET /api/index/current`, `GET /api/index/rebalance`, `GET /api/index/token/:chain/:address`, `GET /api/index/token/:chain/:address/risk`
- `src/arbitrage/` — `GET /api/arbitrage/opportunities`
- `src/backtest/` — `GET /api/backtest/run?days=30`
- `src/nansen/` — all Nansen API access (`nansen.service.ts`); in-memory call counter feeds the hackathon's 1,000-API-call metric
- `src/cache/` — in-memory + optional Redis cache
- `src/database/` — optional PostgreSQL persistence

## Quirks

- **ESM + `module: nodenext`**: relative imports need explicit `.js` extensions (e.g. `import { AppModule } from './app.module.js'`). Omitting it compiles/fails confusingly.
- **No `@nestjs/config`** — `main.ts` loads `.env` via `process.loadEnvFile()` from `apps/api/.env` or the repo-root `.env`. Remaining env is read straight from `process.env`. Keys: `NANSEN_API_KEY`, `PORT_API` (3001), `CACHE_TTL_SECONDS` (300), `REBALANCE_THRESHOLD` (0.05), `DATABASE_URL`, `REDIS_URL`, `MIN_CREDITS_FOR_RISK`. Never commit `.env`.
- oxlint: `typescript/no-floating-promises` is error; `no-explicit-any` is off (`.oxlintrc.json`).
- Stray `package-lock.json` here alongside `bun.lock` — installs were done with bun; don't mix package managers.
