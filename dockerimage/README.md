Ciphernotes (Self‑Hosted) – Docker Compose
=========================================

Production‑ready, self‑hosted deployment of Ciphernotes. This setup runs:
- app: Nginx (serving the SPA and proxy) + backend (Bun)
- db: Postgres 16
- minio: S3‑compatible object storage
- minio‑setup: one‑shot bucket initializer

What you get
------------
- Single `docker compose` up for the whole stack
- DB migrations auto‑applied on startup (no local tooling needed)
- MinIO bucket auto‑created
- Frontend served at port 8080; backend proxied at `/api`; S3 proxied at `/s3` with restricted methods

Quick start
-----------
1) Copy env and adjust minimal settings:
   - On first use:
     - Create `dockerimage/.env` (or copy from an example) with at least:
       - `COOKIE_SECRET` – strong random string
       - Optional admin bootstrap (self‑hosted): `ADMIN_USERNAME`, `ADMIN_PASSWORD`

2) Run:
```
docker compose -f dockerimage/docker-compose.yml up --build -d
```

3) Open:
```
http://localhost:8080
```

Default ports
-------------
- App (Nginx + backend): 8080 → 80
- MinIO API/Console (optional): 9000/9001 (published by default for convenience)

Environment variables (app)
---------------------------
- `COOKIE_SECRET` (required): secret for cookie signing
- `HOSTING_MODE` (optional): default `self`
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` (optional): create/update an admin on first start
- Rate/limits (optional, sensible defaults): `RATE_LIMIT`, `RATE_WINDOW_SEC`, `SESSION_TTL_MIN`, `LIMIT_JSON`, `LIMIT_RAW`, `NOTES_STORAGE_LIMIT`, `FILES_STORAGE_LIMIT`

Environment variables (db/minio)
--------------------------------
- Postgres: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (defaults: `notes`/`notes`/`notes`)
- MinIO: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (defaults set in compose)
- S3 bucket: `S3_BUCKET` (default: `ciphernotes`)

Security notes
--------------
- The app proxies MinIO under `/s3` and limits methods to GET/HEAD/POST for browser flows.
- Keep MinIO root credentials secret. Anyone with valid credentials can perform actions through the proxy.
- Consider not publishing 9000/9001 externally in production; rely on the `/s3` proxy for browser access and the app’s internal S3 client for server‑side ops.

Upgrades
--------
- Pull new app image, then:
```
docker compose -f dockerimage/docker-compose.yml pull app
docker compose -f dockerimage/docker-compose.yml up -d
```
- Migrations run automatically on app startup.

Troubleshooting
---------------
- Check logs:
```
docker compose -f dockerimage/docker-compose.yml logs -f app
```
- Schema not created: ensure `db` is healthy, then restart `app`.
- S3 signature errors: ensure `/s3` proxy preserves `Host 127.0.0.1:9000` (already configured) and that the request path does not include the `/s3` prefix after proxying (rewrite is configured).

Docker Hub usage (publishing)
-----------------------------
If you publish the app image, your `compose.yml` can reference it directly, e.g.:
```yaml
services:
  app:
    image: your-dockerhub-username/ciphernotes-app:latest
    env_file: [.env]
    ports: ["8080:80"]
    depends_on:
      db: { condition: service_healthy }
      minio: { condition: service_started }
      minio-setup: { condition: service_completed_successfully }
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-notes}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-notes}
      POSTGRES_DB: ${POSTGRES_DB:-notes}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-notes}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 5s
    volumes: ["db_data:/var/lib/postgresql/data"]
  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minio-admin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minio-admin}
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    volumes: ["minio_data:/data"]
  minio-setup:
    image: minio/mc:latest
    depends_on: { minio: { condition: service_started } }
    entrypoint: ["/bin/sh", "-c"]
    command: >-
      "mc alias set local http://minio:9000 ${MINIO_ROOT_USER:-minio-admin} ${MINIO_ROOT_PASSWORD:-minio-admin} &&
      (mc ls local/${S3_BUCKET:-ciphernotes} || mc mb -p local/${S3_BUCKET:-ciphernotes})"
    restart: "no"
volumes: { db_data: {}, minio_data: {} }
```

Licenses & attribution
----------------------
- MinIO and `mc` are AGPLv3; in this setup you use the official images. See MinIO: https://github.com/minio/minio
- Ensure you comply with AGPLv3 when redistributing MinIO (e.g., include license notices and source references).
