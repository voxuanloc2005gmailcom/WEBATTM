-- TechGear Store Phase 1: initial ecommerce schema.
-- Execute as techgear_owner, not techgear_app.
-- This migration is intentionally idempotent for development reruns.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT chk_categories_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_categories_slug CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    sku VARCHAR(64) NOT NULL,
    name VARCHAR(180) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    brand VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(12,2) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_products_sku UNIQUE (sku),
    CONSTRAINT uq_products_slug UNIQUE (slug),
    CONSTRAINT chk_products_price CHECK (price >= 0),
    CONSTRAINT chk_products_stock CHECK (stock_quantity >= 0),
    CONSTRAINT chk_products_status CHECK (status IN ('active', 'inactive', 'draft'))
);

CREATE TABLE IF NOT EXISTS product_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(200) NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_product_images_sort_order CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_primary
    ON product_images(product_id)
    WHERE is_primary = TRUE;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    phone_encrypted BYTEA,
    address_encrypted BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_role CHECK (role IN ('customer', 'admin', 'staff')),
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'disabled', 'locked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower
    ON users ((LOWER(email)));

CREATE TABLE IF NOT EXISTS carts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_carts_status CHECK (status IN ('active', 'checked_out', 'abandoned'))
);

CREATE TABLE IF NOT EXISTS cart_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cart_items_cart_product UNIQUE (cart_id, product_id),
    CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0 AND quantity <= 999)
);

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_number VARCHAR(32) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    recipient_name VARCHAR(120),
    recipient_phone_encrypted BYTEA,
    shipping_address_encrypted BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_orders_order_number UNIQUE (order_number),
    CONSTRAINT chk_orders_status CHECK (status IN ('pending', 'payment_pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'payment_failed')),
    CONSTRAINT chk_orders_currency CHECK (currency IN ('VND', 'USD')),
    CONSTRAINT chk_orders_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_orders_shipping_fee CHECK (shipping_fee >= 0),
    CONSTRAINT chk_orders_discount_total CHECK (discount_total >= 0),
    CONSTRAINT chk_orders_grand_total CHECK (grand_total >= 0)
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(180) NOT NULL,
    sku_snapshot VARCHAR(64) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    quantity INTEGER NOT NULL,
    line_total NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_order_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0 AND quantity <= 999),
    CONSTRAINT chk_order_items_line_total CHECK (line_total >= 0),
    CONSTRAINT uq_order_items_order_product UNIQUE (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
    provider VARCHAR(40) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    provider_transaction_ref VARCHAR(128),
    provider_response_code VARCHAR(32),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payments_status CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
    CONSTRAINT chk_payments_amount CHECK (amount >= 0),
    CONSTRAINT chk_payments_currency CHECK (currency IN ('VND', 'USD'))
);

CREATE INDEX IF NOT EXISTS idx_products_category_status
    ON products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_status_created
    ON products(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_products_price
    ON products(price);
CREATE INDEX IF NOT EXISTS idx_product_images_product_sort
    ON product_images(product_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product
    ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_created
    ON orders(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created
    ON orders(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON order_items(order_id, id);
CREATE INDEX IF NOT EXISTS idx_payments_status_created
    ON payments(status, created_at DESC, id DESC);

-- Updated-at trigger used by future application writes.
CREATE OR REPLACE FUNCTION techgear_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION techgear_set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION techgear_set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION techgear_set_updated_at();

DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
CREATE TRIGGER trg_carts_updated_at
BEFORE UPDATE ON carts
FOR EACH ROW EXECUTE FUNCTION techgear_set_updated_at();

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items;
CREATE TRIGGER trg_cart_items_updated_at
BEFORE UPDATE ON cart_items
FOR EACH ROW EXECUTE FUNCTION techgear_set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION techgear_set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION techgear_set_updated_at();

-- Application role should receive DML on all application objects.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO techgear_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO techgear_app;
REVOKE ALL ON schema_migrations FROM techgear_app;
REVOKE ALL ON FUNCTION techgear_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION techgear_set_updated_at() TO techgear_owner;

INSERT INTO schema_migrations(version)
VALUES ('001_initial_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;
