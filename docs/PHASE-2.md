# TechGear Store — Phase 2: Authentication, Sessions & RBAC

## Scope

Phase 2 introduces browser authentication using a server-side session token stored in an HttpOnly cookie. Passwords use bcrypt with 12 salt rounds. Authorization middleware supports role checks for `customer`, `staff`, and `admin`.

## Endpoints

Canonical base: `/api/v1`

Compatibility base: `/api`

- `POST /auth/register` — creates a customer account and an empty cart.
- `POST /auth/login` — verifies credentials and creates a server-side session.
- `POST /auth/logout` — revokes the current session and clears the cookie.
- `GET /auth/me` — returns the authenticated user's safe identity and session expiry.
- `GET /admin/me` — RBAC smoke endpoint for `admin` and `staff`.

## Session security

The browser cookie is:

- `HttpOnly`
- `SameSite=Lax`
- `Secure` when `COOKIE_SECURE=true`
- bounded by `SESSION_TTL_SECONDS` (default 7 days, maximum 30 days)

Only a SHA-256 hash of the session token is stored in PostgreSQL. The raw token is never persisted.

## Password policy

Registration requires a password of 12–128 characters. Passwords are stored as bcrypt hashes using 12 salt rounds. Login failures use a generic `Invalid email or password` response.

## RBAC

`requireAuth` rejects unauthenticated requests with `401 AUTH_REQUIRED`.

`requireRole('admin', 'staff')` rejects authenticated customers with `403 FORBIDDEN`.

Future order/profile/admin endpoints must use these middleware functions and enforce ownership checks server-side.

## Database authorization

The application role remains non-superuser. For authentication data, column-level privileges prevent the application from inserting authorization-sensitive `users.role` and `users.status` values or updating role/status/email/password columns directly. Sessions are writable only through server-generated credential fields and revocation fields.

## Phase 2 acceptance criteria

- Register ignores any client-supplied `role` and creates `customer`.
- Duplicate email returns `409 EMAIL_ALREADY_REGISTERED`.
- Login sets an HttpOnly session cookie.
- `/auth/me` requires authentication.
- Logout revokes the session server-side.
- Customer access to `/admin/me` returns `403`.
- No API response exposes password hashes or stack traces.
- Nginx login rate limit applies to both `/api/auth/login` and `/api/v1/auth/login`.
