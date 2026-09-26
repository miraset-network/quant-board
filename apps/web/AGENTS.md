<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/web — Next.js dashboard

Stack: Next.js 16 (App Router) + React 19 + Tailwind 4 + ESLint flat config. Entry: `app/page.tsx` renders `components/Dashboard.tsx` (client component).

## Commands (run from `apps/web`)

- `bun run dev` / `bun run build` / `bun run lint`
- `next build` runs typechecking — there is **no separate typecheck script**
- **No test setup exists** — don't look for one; don't add one without being asked
- Package manager is bun (`packageManager: bun@1.4.2`, `bun.lock`) — not pnpm, despite the repo root

## Quirks

- API base URL: `NEXT_PUBLIC_API_URL` ?? `http://localhost:3001` (`lib/api.ts`); dashboard polls all three endpoints every 30s
- Types are duplicated in `lib/api.ts` — `@quant-board/shared` exists but is **not wired up**
- Path alias: `@/*` → app root (see `tsconfig.json`)
- Keep the `<!-- BEGIN:nextjs-agent-rules -->` block above intact; `CLAUDE.md` imports this file via `@AGENTS.md`
