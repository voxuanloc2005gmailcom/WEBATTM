# TechGear Store — Phase 1 API Contract

Canonical API base: `/api/v1`

Compatibility base: `/api`

Both bases expose the same Phase 1 endpoints. The versioned base is the preferred frontend integration target.

## Common response shape

Success responses use:

```json
{
  "success": true,
  "data": {}
}
```

Error responses use:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Safe client-facing message"
}
```

Responses never intentionally expose stack traces, SQL text, database credentials, or other internal secrets.

## GET /api/v1/health

Authentication: none.

Returns `200` when both the Node.js process and PostgreSQL application connection are healthy.

Example:

```json
{
  "success": true,
  "service": "techgear-api",
  "database": "ok"
}
```

## GET /api/v1/categories

Authentication: none.

Returns active catalog categories.

Example:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "keyboard",
      "name": "Bàn phím",
      "description": "...",
      "productCount": 3
    }
  ]
}
```

## GET /api/v1/products

Authentication: none.

Query parameters:

- `page`: positive integer, default `1`, maximum `100000`
- `pageSize`: integer `1..100`, default `20`
- `search`: up to 100 characters; searches product name, SKU and brand
- `category`: lowercase slug
- `minPrice`: non-negative number with up to 2 decimal places
- `maxPrice`: non-negative number with up to 2 decimal places
- `sort`: `newest`, `price_asc`, `price_desc`, or `name_asc`; default `newest`

Example response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sku": "KB-001",
      "name": "Keychron K2 V2",
      "slug": "keychron-k2-v2",
      "brand": "Keychron",
      "description": "...",
      "price": 1890000,
      "stockQuantity": 25,
      "status": "active",
      "category": {
        "id": 1,
        "slug": "keyboard",
        "name": "Bàn phím"
      },
      "primaryImage": {
        "imageUrl": "/assets/products/keychron-k2-v2.webp",
        "altText": "Keychron K2 V2"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 12,
    "totalPages": 1
  }
}
```

Validation failures return `400`.

## GET /api/v1/products/:id

Authentication: none.

`:id` must be a positive integer.

Returns `200` with product detail and image list, or `404` with `PRODUCT_NOT_FOUND`.

Example response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "sku": "KB-001",
    "name": "Keychron K2 V2",
    "slug": "keychron-k2-v2",
    "brand": "Keychron",
    "description": "...",
    "price": 1890000,
    "stockQuantity": 25,
    "status": "active",
    "createdAt": "2026-10-06T00:00:00.000Z",
    "updatedAt": "2026-10-06T00:00:00.000Z",
    "category": {
      "id": 1,
      "slug": "keyboard",
      "name": "Bàn phím"
    },
    "images": []
  }
}
```

## Security contract

- Product filtering/search uses parameterized PostgreSQL queries.
- `sort` is allow-listed and never interpolated directly from an untrusted value.
- Pagination values are range-validated.
- Product IDs are validated before querying.
- Price and stock values returned by the API come from PostgreSQL.
- Future cart/order/payment endpoints must calculate totals from server-side database values and must not trust client-supplied totals.
- Authentication, RBAC and IDOR checks are introduced in Phase 2.


## Phase 2 — Authentication

All Phase 2 endpoints are available under the canonical `/api/v1` prefix and the compatibility `/api` prefix. Browser authentication uses a server-side session cookie named `tg_session` by default.

### POST /api/v1/auth/register

Authentication: none.

Request JSON:

```json
{
  "email": "customer@example.com",
  "password": "Str0ng!Password#2026",
  "fullName": "Nguyen Van A"
}
```

The server always creates the account with role `customer`; client-supplied authorization fields are ignored. An empty active cart is created atomically.

Success: `201`. Duplicate email: `409 EMAIL_ALREADY_REGISTERED`. Validation errors: `400`.

### POST /api/v1/auth/login

Authentication: none.

Request JSON:

```json
{
  "email": "customer@example.com",
  "password": "Str0ng!Password#2026"
}
```

Success: `200`. The response sets an HttpOnly session cookie. Invalid credentials return `401 INVALID_CREDENTIALS` with a generic client-facing message.

The Nginx strict rate limit is applied to both `/api/auth/login` and `/api/v1/auth/login`.

### POST /api/v1/auth/logout

Authentication: optional; when a valid session exists, it is revoked server-side. The response also clears the session cookie.

Success: `200`.

### GET /api/v1/auth/me

Authentication: required.

Success: `200`. Unauthenticated: `401 AUTH_REQUIRED`.

Example:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "customer@example.com",
      "fullName": "Nguyen Van A",
      "role": "customer",
      "status": "active"
    },
    "session": {
      "expiresAt": "2026-10-13T13:00:00.000Z"
    }
  }
}
```

No password hash is returned.

### GET /api/v1/admin/me

Authentication: required.

Roles: `admin`, `staff`.

Customer requests return `403 FORBIDDEN`. Unauthenticated requests return `401 AUTH_REQUIRED`.

## Phase 2 security rules

- Passwords are bcrypt hashes with 12 salt rounds.
- Raw session tokens are not stored; only SHA-256 token hashes are persisted.
- Session cookies are HttpOnly and SameSite=Lax, with Secure enabled for tunnel/production deployments.
- Login failures do not reveal whether an email exists.
- Authorization decisions are made server-side from the authenticated session's role.
- Future object endpoints must perform ownership checks before returning or modifying user-owned records to prevent IDOR.

## Phase 3 — Cart, Checkout and Orders

Authenticated endpoints are available under both `/api` and `/api/v1`.

- `GET /cart` — current user's active cart.
- `POST /cart/items` — add/increase an item. Body: `{ productId, quantity }`.
- `PATCH /cart/items/:id` — set quantity.
- `DELETE /cart/items/:id` — remove an owned cart item.
- `POST /checkout` — creates a server-priced `payment_pending` order from the authenticated user's cart. Body: `{ recipientName, recipientPhone, shippingAddress }`. Recipient phone and shipping address are stored as AES-256-GCM encrypted BYTEA.
- `GET /orders` — current user's orders only.
- `GET /orders/:id` — order detail only when `orders.user_id` matches the authenticated user; otherwise `404 ORDER_NOT_FOUND` to avoid exposing object existence.
- `POST /orders/:id/cancel` — cancels a pending/payment-pending order owned by the user and restores reserved stock.


## Phase 3 — VNPAY Sandbox

- `POST /payment/create` — authenticated, owner-scoped creation of a signed VNPAY Sandbox payment URL. Body: `{ orderId }`. The amount is always re-read from PostgreSQL.
- `GET /payment/vnpay_return` — verifies the VNPAY HMAC-SHA512 signature and amount, then redirects the browser to the frontend payment result/order page. It does not trust the query string as the source of payment state.
- `GET /payment/vnpay_ipn` — server-to-server VNPAY callback. Signature is verified first; merchant code and amount are checked against DB; payment/order are updated atomically and idempotently.
- VNPAY Version `2.1.0` is used; `vnp_SecureHashType` is not sent.

## TechBot Advisor — v2.2.0
- `POST /api/v1/techbot` (compatibility alias: `/api/techbot`)
- Body: `{ "question": "..." }`, maximum 600 characters.
- Normal response: `{ success: true, data: { answer, engine, recommendations } }`.
- Prompt-injection/data-exfiltration requests return `400 TECHBOT_PROMPT_BLOCKED`.
- More than five requests per minute per authenticated account/IP return `429 TECHBOT_RATE_LIMITED`.
- TechBot receives public catalog context only; it has no database tools for user orders, sessions or secrets.
- `GET /api/v1/techbot/health` reports whether the optional Ollama engine is configured.
