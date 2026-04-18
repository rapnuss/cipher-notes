Ciphernotes (Self‑Hosted) – Docker Compose
==========================================

Self‑hosted deployment of Ciphernotes. This setup runs:
- app: Nginx (serving the SPA and proxy) + backend (Bun)
- db: Postgres 16
- minio: S3‑compatible object storage
- minio‑setup: one‑shot bucket initializer

What you get
------------
- Single `docker compose` up for the whole stack
- DB migrations auto‑applied on startup (no local tooling needed)
- MinIO bucket auto‑created
- Frontend served at port 13064; backend proxied at `/api`; S3 proxied at `/s3` with restricted methods

Quick start
-----------
1) Copy env and adjust minimal settings:
   - On first use:
     - Create `dockerimage/.env` (or copy from an example) with at least:
       - `COOKIE_SECRET` – use a random guid
       - s3 bucket credentials: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` - Use secure credentials, the bucket is exposed via the `/s3` proxy!!!
       - admin bootstrap: `ADMIN_USERNAME`, `ADMIN_PASSWORD` - The admin can create users.

2) Run:
```
docker compose -f dockerimage/docker-compose.yml up --build -d
```

3) Open:
```
http://localhost:13064
```

Security notes
--------------
- The app proxies MinIO under `/s3` and limits methods to GET/HEAD/POST for browser flows.
- Keep MinIO root credentials secret. Anyone with valid credentials can perform actions through the proxy.
- Consider not publishing 9000/9001 externally in production; rely on the `/s3` proxy for browser access and the app’s internal S3 client for server‑side ops.

Troubleshooting
---------------
- Check logs:
```
docker compose -f dockerimage/docker-compose.yml logs -f app
```
- Schema not created: ensure `db` is healthy, then restart `app`.
- S3 signature errors: ensure `/s3` proxy preserves `Host 127.0.0.1:9000` (already configured) and that the request path does not include the `/s3` prefix after proxying (rewrite is configured).
