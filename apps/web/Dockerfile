# syntax=docker/dockerfile:1

# Build context is the REPO ROOT (docker-compose sets context: ".").
# apps/web resolves @quant-board/shared via tsconfig paths to
# ../../packages/shared/dist/index.d.ts, so /repo/packages/shared must be built
# before `next build` typechecks.

########## deps ##########
FROM oven/bun:1.4.2 AS deps
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install --frozen-lockfile

########## shared ##########
FROM oven/bun:1.4.2 AS shared
WORKDIR /repo/packages/shared
COPY packages/shared/package.json packages/shared/bun.lock ./
RUN bun install --frozen-lockfile
COPY packages/shared/ ./
RUN bun run build

########## build ##########
FROM oven/bun:1.4.2 AS build
WORKDIR /repo/apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps/web/ ./
COPY --from=deps /repo/apps/web/node_modules ./node_modules
COPY --from=shared /repo/packages/shared /repo/packages/shared
RUN bun run build

########## runtime ##########
FROM oven/bun:1.4.2-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next ./.next
COPY --from=build /repo/apps/web/public ./public
COPY --from=build /repo/apps/web/package.json ./package.json
COPY --from=build /repo/apps/web/node_modules ./node_modules
EXPOSE 3000
USER bun
CMD ["bun", "run", "start"]
