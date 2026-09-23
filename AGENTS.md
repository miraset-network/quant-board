# AGENTS.md

Primary instructions: node_modules/@daochild/agents-config/AGENTS.md — read in full and follow unless overridden below.

Hackathon project ("Token God Indexes") for the Nansen Meridian Buildathon (Sep 22–28 2026). Bias toward a working demo over refactoring. `PLAN.md` is the day-by-day build plan; `CONDITIONS.md` has submission rules (1,000+ Nansen API calls, demo < 10 min).

## Structure

- `apps/api` — NestJS 12 backend, **ESM**, listens on **3001** (`PORT_API`)
- `apps/web` — Next.js 16 + React 19 + Tailwind 4 dashboard, polls API every 30s
- `packages/shared` — `@quant-board/shared` TS types; **not imported by either app yet** (web duplicates types in `apps/web/lib/api.ts`)
- `agents/*` — standalone Python tools (`daily_smta`, `token_god_mode`); **not** in the pnpm/turbo workspace
- `ARCHITECTURE.md` / `PLAN.md` describe Express + Next 14 — **stale**; the code is NestJS 12 + Next 16. Trust the code.

## Package managers are mixed — don't assume

Root declares `pnpm` + pnpm workspace + turbo, but there is **no root lockfile**. `apps/api` and `apps/web` each have their own `bun.lock` (web also pins `packageManager: bun@1.4.2`; api additionally has a stray `package-lock.json`). Installs were done per-app with bun. Run scripts from inside each app directory.

## Commands

Turbo at the root only defines `dev` / `build` / `clean` — there is **no** `turbo lint` or `turbo test`; run those per-app.

Per-app commands live in **`apps/api/AGENTS.md`** and **`apps/web/AGENTS.md`** — read those before working in either app. Highlights:

- `apps/api`: `bun run start:dev` / `test` / `test:e2e` / `lint` (oxlint, not eslint) / `build` (doubles as typecheck)
- `apps/web`: `bun run dev` / `build` / `lint`; no tests; `next build` typechecks
- Python agents (`agents/daily_smta`, `agents/token_god_mode`): `uv pip install -e ".[dev]"`, own `.env` from `.env.example`, run `python -m daily_smta` / `token-god-mode` CLI, verify with `pytest -v` + `ruff check .` (config in each `pyproject.toml`: py311+, line-length 100)
