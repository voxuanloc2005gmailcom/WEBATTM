# TechGear v2.4.0 — Final Frontend Restoration

This release is a frontend restoration pass focused on stable e-commerce layout, real product photography, and reliable authentication UX.

## Frontend improvements
- Reworked homepage hero into a deterministic two-column layout with real product photography cards instead of decorative/illustrative product SVGs.
- Reworked featured category cards into photo-first cards with constrained text so labels cannot escape their cards.
- Standardized product-card image ratio, content rhythm, price area, and CTA placement.
- Fixed responsive layout rules for desktop, tablet, and mobile breakpoints.
- Fixed modal stacking: auth/quick-view/confirm dialogs are fixed and centered above the overlay.
- Fixed login/register session confirmation by verifying `/auth/me` after the login request.
- Preserved the existing HttpOnly cookie security model; HTTPS is required when the secure cookie mode is enabled by the tunnel compose profile.
- Removed duplicate TechBot route render and duplicate checkout phone payload field.
- Added frontend cache-busting version `2.4.0`.
- Kept real product photography for all 12 seeded products. A failed remote photo now falls back only to a neutral placeholder, never a fake product illustration.

## Validation
- Frontend static verification: PASS.
- JavaScript syntax checks: PASS.
- Local frontend HTTP smoke test for `/`, `/healthz`, `/styles.css`, `/app.js`, and `/js/views.js`: PASS.
- Deep frontend assertions for login, modal stacking, real-photo mapping, duplicate payload removal, and legacy residue: PASS.
- Backend test result from the working Windows environment: 34/34 PASS, 0 FAIL.

## Scope protection
The final restoration changes only frontend files plus frontend documentation/media-source notes. `backend/`, `database/`, `nginx/`, and compose files are byte-for-byte unchanged from the v2.3.1 input archive.

The archive intentionally excludes the real `.env` file. Copy the existing working `.env` into the project root before running Docker.


## v2.4.2 UI crash fix
- Removed undefined `categoryKind()` call from category navigation rendering.
- Bumped frontend asset cache version to 2.4.2.
