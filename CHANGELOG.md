# Changelog

## v2.3.0 — Frontend production UI polish
- Reworked the storefront UI into a consistent e-commerce design system.
- Added real product photography URLs for all 12 seeded products with graceful local SVG fallback.
- Fixed frontend action mismatches for cart, Buy Now, sort, orders and TechBot.
- Added responsive layouts and missing utility/component styles.
- Preserved backend, database, authentication, VNPAY and TechBot security behavior.


## v2.2.1 — Final verification hardening
- Fixed the compatibility `backend/server.js` entrypoint so it starts the canonical server exactly once.
- Strengthened TechBot output filtering for internal system/developer instruction disclosure.
- Added direct TechBot disclosure-filter regression coverage.
- Made the final verification script self-contained in local mode so it does not require a Cloudflare tunnel token merely to run the security suite.

## v2.1.1
- Fixed cart reusability after checkout: purchased cart items are cleared and the user cart remains active.
- Added regression coverage for adding a new item after checkout/cancellation.

# Changelog

## v2.1.0 - VNPAY Sandbox

- Added VNPAY Sandbox payment URL creation with HMAC-SHA512 signing.
- Added signed Return URL verification and server-to-server IPN handling.
- IPN verifies merchant code and amount against PostgreSQL before changing order/payment state.
- Failed payments release reserved stock exactly once before marking the order `payment_failed`.
- Added frontend VNPAY payment button and payment result handling.
- Added VNPAY unit tests and setup documentation.
- Added matching Nginx protections for `/api` and `/api/v1` payment endpoints.

## v2.0.3- Scoped shop authentication middleware to `/cart`, `/checkout`, and `/orders`.
- Prevented public `/health` and `/products`/`/categories` routes from being affected by protected-shop middleware.
- Prevented unknown `/api/*` paths from being converted into authentication errors solely because they pass through `shopRouter`.
- No database migration changes required.

## v2.0.1
- Fix Express router mounting so authentication middleware for cart/checkout/orders does not intercept public catalog and auth routes.
- Add regression coverage for unauthenticated public catalog access.


## v1.9.1
- Fixed Phase 2 authentication test cookie extraction to pass the Response object correctly.
- Included the Nginx log-volume permission fix in the Phase 2 package (master runs as root; workers run as `nginx`).

## v1.9 — Phase 2 Authentication

- Added bcrypt password hashing with 12 salt rounds.
- Added server-side session authentication with HttpOnly cookies.
- Added register/login/logout/me endpoints.
- Added reusable authentication and RBAC middleware.
- Added column-level database restrictions for authentication-sensitive user fields.
- Added authentication integration tests.
- Applied strict Nginx login rate limiting to both versioned and compatibility login endpoints.
# Changelog

## v1.8 — Phase 1 Database + Backend Foundation

- Added the initial PostgreSQL ecommerce schema and indexes.
- Added owner-run migration and idempotent catalog seed scripts.
- Added the Express + node-postgres backend foundation.
- Added catalog APIs for health, categories, product list and product detail.
- Added parameterized search/filter queries with allow-listed sorting and bounded pagination.
- Added safe request IDs and non-leaking API error responses.
- Added backend automated API tests.
- Kept `techgear_app` as the least-privileged application database role.
- Preserved the v1.7 Nginx/ModSecurity baseline and fixed the PowerShell 5.1 DB smoke-test invocation.

## 0.4.0 — Phase 3
- Added authenticated cart, checkout and order APIs.
- Added transactional server-side price/stock validation and stock restoration on cancellation.
- Added owner-scoped order access checks to prevent IDOR.
- Added AES-256-GCM encryption for order recipient phone/address.

## v2.0.2

- Fix shop router mounting so /cart, /checkout, and /orders resolve correctly without protecting public/auth/catalog routes.

## v2.2.0 — TechBot + security hardening
- Added TechBot Advisor endpoint with optional local Ollama integration and a safe catalog-only fallback.
- Added prompt-injection and data-exfiltration input/output safeguards.
- Added TechBot rate limiting at 5 requests/minute per authenticated account or IP, plus matching Nginx edge limiting.
- Added frontend TechBot Advisor page and safe usage guidance.
- Kept checkout cart reusable and added direct checkout-to-reuse regression coverage.
