# TechGear Store — Phase 1 Implementation

## Scope

Phase 1 adds the initial PostgreSQL ecommerce schema, seed catalog data, Express API foundation, parameterized product queries, validation, safe error handling, and automated API tests.

## Database setup

The PostgreSQL container exposes these development-only mount points:

- `/migrations` → `database/migrations`
- `/seed` → `database/seed`

Run the stack first, then:

```powershell
.\scripts\db-migrate.ps1
.\scripts\db-seed.ps1
```

The migration is idempotent for development reruns. It must be executed by `techgear_owner`; the backend continues to use only `techgear_app`.

## Start

```powershell
docker compose -f compose.yml -f compose.local.yml up -d --build
```

## API tests

The backend test suite is configured to reach Nginx from the backend network:

```powershell
docker compose -f compose.yml -f compose.local.yml exec backend npm test
```

To run host-side tests against the published local port:

```powershell
$env:TEST_BASE_URL = 'http://localhost:8080'
```

## Phase 1 acceptance criteria

- Database migration completes as `techgear_owner`.
- Seed data inserts/updates catalog rows.
- Backend `/health` proves PostgreSQL connectivity.
- `/api/v1/categories` returns active categories.
- `/api/v1/products` supports validated pagination, filters and allow-listed sorting.
- `/api/v1/products/:id` returns detail or a safe 404.
- SQL injection-shaped search input does not become executable SQL.
- Backend does not expose stack traces or database secrets.
- Application role remains least-privileged.
- Existing Phase 0 bootstrap smoke tests continue to pass.
