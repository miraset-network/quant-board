# AGENTS.md

Repo is greenfield (only `LICENSE` committed as of 2026-09-17). No code, manifests, CI, or `SOW.md` yet.

## Source of truth

- `SOW.md` (when added, root or per-project) defines scope, architecture, and acceptance criteria. It overrides this file on conflicts.
- Until manifests exist, do not assume scripts, frameworks, DB, or deploy flow. Read `package.json` / `bunfig.toml` / `tsconfig*.json` once added; trust those over prose.

## Planned monorepo

User intent: Bun + TypeScript monorepo with 3 separate projects — backend, landing, dashboard.

- Keep them independent: no cross-imports between the three except via an explicit shared package if `SOW.md` defines one.
- Expected layout (confirm against `SOW.md` when it lands; do not create competing layouts):
  - `apps/backend`, `apps/landing`, `apps/dashboard` (or top-level equivalents)
  - `packages/*` only for truly shared code.
- New code must use Bun workspaces, not npm/yarn/pnpm. Check `bun --version` first.

## Bun conventions

- Install: `bun install`
- Run: `bun run <script>` (per-workspace: `bun --filter <name> <script>`, verify filter syntax in root `package.json` once defined)
- Test: `bun test`
- One-off tools: `bunx <pkg>` (no `npx`)
