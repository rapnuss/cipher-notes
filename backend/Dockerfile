FROM oven/bun:1.3.14-alpine AS base

FROM base AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build
RUN chown -R bun:bun .

FROM base AS app
COPY --parents --from=build /app/dist /app/package.json /app/jwt-private.pem /
WORKDIR /app
USER bun
ENTRYPOINT [ "bun", "start" ]
