-- TechGear Store Phase 2: authentication and session security.
-- Execute as techgear_owner, not techgear_app.

BEGIN;

CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL,
    user_agent VARCHAR(500),
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uq_user_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT chk_user_sessions_expiry CHECK (expires_at > created_at),
    CONSTRAINT chk_user_sessions_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
    ON user_sessions(user_id, expires_at DESC)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry
    ON user_sessions(expires_at)
    WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS trg_user_sessions_updated_at ON user_sessions;
CREATE TRIGGER trg_user_sessions_updated_at
BEFORE UPDATE ON user_sessions
FOR EACH ROW EXECUTE FUNCTION techgear_set_updated_at();

GRANT SELECT ON user_sessions TO techgear_app;
GRANT INSERT (user_id, token_hash, user_agent, ip_address, expires_at) ON user_sessions TO techgear_app;
GRANT UPDATE (revoked_at, updated_at) ON user_sessions TO techgear_app;
GRANT USAGE, SELECT ON SEQUENCE user_sessions_id_seq TO techgear_app;

-- Prevent the application role from changing authorization-sensitive user columns.
REVOKE INSERT ON users FROM techgear_app;
GRANT INSERT (email, password_hash, full_name) ON users TO techgear_app;
REVOKE UPDATE ON users FROM techgear_app;
GRANT UPDATE (full_name, phone_encrypted, address_encrypted, updated_at) ON users TO techgear_app;

INSERT INTO schema_migrations(version)
VALUES ('002_authentication')
ON CONFLICT (version) DO NOTHING;

COMMIT;
