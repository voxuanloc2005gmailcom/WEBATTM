# TechGear Store — Final secure ecommerce demo v2.3.0

This repository contains the final TechGear Store ecommerce demo: PostgreSQL database, secure Node.js API, VNPAY Sandbox integration, ModSecurity/Nginx security layer, TechBot Advisor and a production-like responsive storefront UI. Backend/security behavior is kept server-authoritative.



## v2.3.0 final UI

- Production-like responsive ecommerce UI with consistent design system.
- Real product photography URLs are mapped for all 12 seeded products, with built-in SVG fallback when an external host is unavailable.
- Frontend static integrity checks are included in `security/tests/frontend-static-check.mjs`.
- The final verifier runs the frontend static checks together with the existing backend, WAF, DB, TLS and TechBot checks.

> The distributable ZIP intentionally excludes `.env`. Copy your local `.env` into the project root before running the stack.

## Phase 1 — Database + Backend foundation

The repository now includes the first real ecommerce schema and API. The Phase 1 scope is deliberately limited to catalog foundations so authentication, cart/order logic and VNPAY can be layered on safely in later phases.

### Database migration and seed

Run the stack first, then execute migrations and seed as the `techgear_owner` role:

```powershell
.\scripts\db-migrate.ps1
.\scripts\db-seed.ps1
```

The backend continues to connect with `techgear_app`; no backend code uses the bootstrap superuser. The migration is development-rerunnable and the seed uses idempotent upserts.

### Phase 1 API

Preferred endpoints:

- `GET /api/v1/health`
- `GET /api/v1/categories`
- `GET /api/v1/products`
- `GET /api/v1/products/:id`

Compatibility aliases are also exposed under `/api/...`.

See [API-CONTRACT.md](API-CONTRACT.md) for request/response details.

### Backend tests

With the local stack running:

```powershell
docker compose -f compose.yml -f compose.local.yml exec backend npm test
```

The tests cover health, categories, catalog pagination, parameterized search behavior, input validation and safe 404 handling.

## v1.7 runtime fix

- Removed per-location `modsecurity_rules_file /etc/modsecurity.d/setup.conf;` directives from the custom virtual-server template. The official OWASP CRS Nginx image already loads `/etc/modsecurity.d/setup.conf` once through its packaged `conf.d/modsecurity.conf.template`; repeating that rules file in multiple locations caused ModSecurity to load CRS rule IDs more than once and Nginx to exit with `Rule id: 200000 is duplicated`.
- `modsecurity on;` remains at the location level so each protected application route explicitly enables the inherited ModSecurity ruleset.

## v1.6 fixes after code review

- Native commands that intentionally produce PostgreSQL stderr are wrapped by `Invoke-Native` so the smoke test remains compatible with Windows PowerShell 5.1 as well as PowerShell 7.
- The least-privilege `CREATE TABLE` test now requires both a non-zero exit code and the expected `permission denied for schema public` reason.
- The DML smoke test drops any previous test table before recreating it, making repeated runs idempotent.
- `.gitattributes` keeps `Dockerfile` and `*.js` LF-only in addition to shell/SQL/template/config files.
- The DML test uses a valid SQL string literal for the inserted `smoke` value.
- The Nginx bootstrap access log is written to `/var/log/nginx/techgear-access.log` so the real-IP smoke test is not dependent on the image default `/dev/stdout` access-log path.

## v1.3 fixes after code review

- PostgreSQL role grants SQL is no longer mounted into `/docker-entrypoint-initdb.d`; only the executable role bootstrap script is mounted there. The SQL grant file is mounted at `/sql/grants.sql` and invoked explicitly by `01-create-roles.sh`. This prevents the PostgreSQL official entrypoint from executing the grant file a second time without the required `-v` variables.
- Sequence privileges for the app role are `USAGE, SELECT`; `UPDATE` is intentionally omitted.
- HSTS is temporary during bootstrap: `max-age=300`, with no `includeSubDomains` or preload. Increase only after the final hostname/subdomain topology is stable.
- `.gitignore` covers `.env.*`, backups, and local TLS certificates while explicitly allowing `.env.example`.
- `.env.example` contains blank secret values instead of `CHANGE_ME...` placeholders.
- The smoke test rejects any `.env` containing `CHANGE_ME`.
- Smoke tests now prove DB least privilege: owner/app roles are not superusers, the app cannot `CREATE TABLE`, and the app can perform DML on owner-created objects using the identity sequence.
- The real-IP test targets `/` rather than `/healthz` because `/healthz` has `access_log off`.

## v1.1 fixes

- PostgreSQL 18 volume is mounted at `/var/lib/postgresql` as required by the PostgreSQL 18 official image layout.
- The PostgreSQL bootstrap account is separate from the backend application role.
- Database roles: bootstrap/superuser (image only), owner/migration role, and app/DML role.
- Secrets are mandatory through `${VAR:?message}`; no silent weak password fallback.
- Backend uses separate DB environment variables rather than embedding a password in a `DATABASE_URL`.
- `cloudflared` reads `TUNNEL_TOKEN` from the environment and is pinned to `2026.9.1`.
- Tunnel mode assigns `cloudflared` a fixed Docker IP `172.30.0.3` and Nginx trusts only `172.30.0.3/32` for `CF-Connecting-IP`.
- Local/non-tunnel mode trusts no remote proxy for `CF-Connecting-IP`; a client-supplied header cannot rewrite `$remote_addr`.
- Security headers are present on the HTTP `8080` path as well as local HTTPS `8443`.
- `X-Forwarded-Proto` is `$scheme` for direct access and is fixed to `https` in tunnel mode.
- VNPAY IPN has its own Nginx location for later CRS false-positive tuning.
- Scanner blocking is implemented as a ModSecurity rule so the block is visible in the JSON audit log.
- The OWASP CRS image's built-in `/healthz` healthcheck is used; custom `wget` healthchecks are not required for Nginx.

## Verified image availability

The current official Docker Hub listings show:

- `owasp/modsecurity-crs:4.25.1-nginx-202609180209` with `linux/arm64` and `linux/amd64` manifests.
- `cloudflare/cloudflared:2026.9.1` with `linux/arm64` and `linux/amd64` manifests.

Always run `docker compose pull` before relying on a tag in a new environment.

## VNPAY Sandbox

Phase 3 now includes VNPAY Sandbox payment URL creation, Return URL signature verification, and server-to-server IPN reconciliation using VNPAY API 2.1.0 and HMAC-SHA512. Configure merchant credentials in `.env`; see `docs/VNPAY-SANDBOX.md`.

## Local mode

1. Copy the environment template:

```powershell
Copy-Item .env.example .env
```

2. Fill the three blank PostgreSQL secret values with strong alphanumeric passwords. Do not use `CHANGE_ME` placeholders.

3. Validate interpolation:

```powershell
docker compose -f compose.yml -f compose.local.yml config
```

4. Pull images:

```powershell
docker compose -f compose.yml -f compose.local.yml pull
```

5. Start the stack:

```powershell
docker compose -f compose.yml -f compose.local.yml up -d --build
```

6. Check:

```powershell
docker compose -f compose.yml -f compose.local.yml ps
docker compose -f compose.yml -f compose.local.yml logs nginx
```

Endpoints:

- `http://localhost:8080`
- `https://localhost:8443` (self-signed certificate in this bootstrap)

## Tunnel mode

A remotely-managed named Cloudflare Tunnel is used for public access. Cloudflare's current Docker guidance supports storing the token as `TUNNEL_TOKEN`; Quick Tunnels are temporary and should not be used as the stable public deployment path. 

Put the token into `.env`:

```env
CLOUDFLARE_TUNNEL_TOKEN=...
```

Start:

```powershell
docker compose -f compose.yml -f compose.tunnel.yml up -d --build
```

There are intentionally **no host ports** for Nginx in tunnel mode. `cloudflared` reaches `http://nginx:8080` over the internal Docker edge network. Public TLS terminates at Cloudflare; Nginx therefore receives HTTP from `cloudflared` and is explicitly configured to tell the backend `X-Forwarded-Proto: https`.

## Local vs tunnel IP trust

### Local/direct

```text
Client -> Docker-published Nginx
```

Nginx does **not** trust a client-supplied `CF-Connecting-IP` header because the trusted source is only `127.0.0.1`.

### Tunnel

```text
Client -> Cloudflare -> cloudflared (172.30.0.3) -> Nginx (172.30.0.2)
```

Only `172.30.0.3/32` is trusted for `CF-Connecting-IP`.

This makes the per-IP rate-limit value meaningful in tunnel/Oracle deployments; Docker Desktop local testing mainly proves that Nginx's `limit_req` mechanism can return `429`.

## Security headers

The HTTP 8080 listener returns:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Content-Security-Policy`
- `Referrer-Policy`

Later, the CSP will be tuned for the real frontend framework and asset sources.

## Rate limiting

The assignment-oriented limits remain in Nginx:

- Global: `10 req/s` with `burst=20`.
- Login/payment create: `1 req/s` with `burst=3`.
- Limit overflow: HTTP `429`.

A future security test will target `/api/auth/login` and demonstrate `429` directly from Nginx.

## WAF

ModSecurity is enabled with the OWASP CRS. Two bootstrap checks are planned:

1. SQLi-shaped query: `?id=1' OR '1'='1` -> `403`.
2. `User-Agent: sqlmap/...` -> `403` via a custom ModSecurity rule.

The audit log uses JSON and concurrent storage under `/var/log/modsecurity/audit/`.

## Bootstrap test suite

On Windows PowerShell, after the local stack is running:

```powershell
.\security\tests\bootstrap-smoke.ps1
```

For a **fresh database initialization** test, remember that PostgreSQL only runs files in `/docker-entrypoint-initdb.d` when the data directory is empty. On a disposable first-run stack you can reset it with:

```powershell
docker compose -f compose.yml -f compose.local.yml down -v
docker compose -f compose.yml -f compose.local.yml up -d --build
```

Do **not** use `down -v` on a database containing data you need to keep.

The suite verifies:
0. The custom Nginx template does not re-declare `modsecurity_rules_file`; the packaged CRS configuration remains the single ruleset loader.

1. Missing `.env` causes `docker compose config` to fail because required secrets use `:?`.
2. A configured `.env` contains no `CHANGE_ME` placeholders.
3. A fake `CF-Connecting-IP: 1.2.3.4` does not rewrite `remote_addr` in local mode.
4. HTTP `8080` exposes the required security headers.
5. SQLi payload returns `403`.
6. `sqlmap` User-Agent returns `403`.
7. The Nginx container reports `healthy`.
8. ModSecurity JSON audit logs contain rule information and the custom scanner-block message.
9. The owner and app PostgreSQL roles are not superusers.
10. The app role cannot `CREATE TABLE`, and the failure reason is `permission denied for schema public`.
11. The owner role can create a test object and the app role can perform DML on it using identity-sequence privileges.

## PostgreSQL roles

The image bootstrap account is created as a superuser by the official PostgreSQL image. It is intentionally **not** used by the application.

Expected roles:

```text
techgear_bootstrap  -> initialization/admin only
techgear_owner      -> schema/migration owner
techgear_app        -> application login; DML only
```

The app role receives:

```text
SELECT
INSERT
UPDATE
DELETE
```

plus required sequence privileges. Future objects created by the owner role receive the same DML defaults.

## Important production notes

- Do not reuse bootstrap secrets in production.
- Do not commit `.env`.
- Rotate Cloudflare tunnel tokens if exposed.
- PostgreSQL init scripts run only when the database volume is initialized for the first time. After a volume already exists, role/schema changes should be handled by migrations, not by editing init scripts and restarting.
- Before moving to Oracle Ampere A1, run the same Compose stack on an ARM64 environment and keep periodic `pg_dump` backups outside the VM.
- The current stack is still a bootstrap, not a finished e-commerce application.

## Phase 3 setup

From PowerShell, generate the local AES-256-GCM key once:

`powershell -ExecutionPolicy Bypass -File .\scripts\ensure-aes-key.ps1`

Then rebuild the stack. Checkout/order endpoints require authentication.

## TechBot Advisor — v2.2.0

TechBot is available at `#/techbot` and `POST /api/v1/techbot`. The server blocks common prompt-injection/data-exfiltration patterns, supplies only public product catalog context to the optional Ollama engine, filters unsafe model output, and never provides order/session/secret data to the model.

The free path uses local Ollama. Configure:

```env
TECHBOT_ENABLED=true
TECHBOT_OLLAMA_URL=http://host.docker.internal:11434
TECHBOT_MODEL=qwen2.5:3b
```

Without Ollama, the endpoint falls back to a deterministic catalog advisor so the secure API and frontend remain functional. The assigned AI rate limit is 5 requests/minute per account or IP, with an additional Nginx edge limit.
