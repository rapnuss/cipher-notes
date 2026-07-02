FROM oven/bun:1.3.14-alpine AS base

FROM base AS build
WORKDIR /app
COPY . .
RUN [ -f jwt-private.pem ] || touch jwt-private.pem
RUN bun install --frozen-lockfile
RUN bun run build

FROM base AS app
WORKDIR /app
COPY --from=build --chown=bun:bun /app/dist ./dist
COPY --from=build --chown=bun:bun /app/package.json ./package.json
COPY --from=build --chown=bun:bun /app/jwt-private.pem ./jwt-private.pem
USER bun
ENTRYPOINT [ "bun", "start" ]
