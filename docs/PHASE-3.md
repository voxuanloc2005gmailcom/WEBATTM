# TechGear Store Phase 3

Phase 3 adds the authenticated shopping flow and sensitive-data protection:

- user-scoped cart endpoints
- server-side price and stock validation
- transactional checkout with row locking
- order and order-item snapshots
- pending VNPAY payment record
- owner-scoped order queries (IDOR protection)
- AES-256-GCM encryption for order recipient phone/address
- stock restoration on cancellation

## AES-256-GCM key

`AES_KEY` must be base64 for exactly 32 random bytes. Run `scripts/ensure-aes-key.ps1` before starting the stack if the key is missing.

The key must never be committed to source control or returned by an API.

### v2.0.3 routing fix
The protected shop router is mounted at API root, but authentication middleware is scoped only to `/cart`, `/checkout`, and `/orders`. This keeps public health/catalog routes public and avoids order-dependent middleware behavior.
