-- TechGear Store Phase 3: cart, checkout, order and encrypted sensitive data.
-- Schema columns for encrypted PII already exist in 001_initial_schema.sql.
-- This migration records the phase and reinforces least-privilege defaults.

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON carts TO techgear_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cart_items TO techgear_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO techgear_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO techgear_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO techgear_app;
GRANT USAGE, SELECT ON SEQUENCE carts_id_seq, cart_items_id_seq, orders_id_seq, order_items_id_seq, payments_id_seq TO techgear_app;

INSERT INTO schema_migrations(version)
VALUES ('003_checkout_security')
ON CONFLICT (version) DO NOTHING;

COMMIT;
