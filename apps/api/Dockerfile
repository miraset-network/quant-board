# syntax=docker/dockerfile:1

# Build context is the REPO ROOT (docker-compose sets context: ../..).
# The API resolves @quant-board/shared via tsconfig paths to ../../packages/shared/dist,
# so the build runs from /repo/apps/api with /repo/packages/shared present.

########## deps ##########
FROM oven/bun:1.4.2 AS deps
WORKDIR /repo/apps/api
COPY apps/api/package.json apps/api/bun.lock ./
RUN bun install --frozen-lockfile

########## build ##########
FROM oven/bun:1.4.2 AS build
WORKDIR /repo/apps/api
COPY apps/api/ ./
COPY packages/shared/ /repo/packages/shared/
COPY --from=deps /repo/apps/api/node_modules ./node_modules
RUN bun run build

########## runtime ##########
FROM oven/bun:1.4.2-slim AS runtime
WORKDIR /repo/apps/api
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY apps/api/package.json ./
EXPOSE 3001
USER bun
CMD ["bun", "dist/main.js"]
