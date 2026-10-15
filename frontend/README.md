# TechGear Store Frontend

The final storefront is a responsive, dependency-light single-page ecommerce UI.

## Design direction

The UI takes the practical structure used by large Vietnamese e-commerce sites: a persistent search/header area, category navigation, filterable product listing, clear price/stock presentation, account/cart entry points, and simple order tracking. It intentionally avoids a flashy visual style.

## Security notes

- API calls use the same-origin `/api/v1` path through Nginx.
- Browser authentication uses the server-side HttpOnly session cookie; no auth token is stored in localStorage.
- The UI never submits a client-side total or price during checkout.
- Product IDs, quantities, and response text are rendered with escaping/controlled URL encoding.
- No inline script or inline event handler is required, which keeps the existing restrictive CSP compatible.


## Product photography

The seeded catalog has real product-photo URLs mapped in `public/js/views.js`. Images load from their published HTTPS source at runtime and fall back to local SVG category artwork if an external image cannot be loaded. See `docs/PRODUCT-IMAGE-SOURCES.md` for the source list.
