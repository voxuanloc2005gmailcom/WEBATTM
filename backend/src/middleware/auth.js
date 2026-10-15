import { hashSessionToken, extractSessionToken } from '../utils/auth.js';
import { query } from '../db/pool.js';

export async function loadAuthenticatedUser(req, _res, next) {
  try {
    const token = extractSessionToken(req);
    if (!token || token.length < 40 || token.length > 200) {
      req.auth = null;
      return next();
    }

    const tokenHash = hashSessionToken(token);
    const result = await query(`
      SELECT
        s.id AS session_id,
        s.user_id,
        s.expires_at,
        u.email,
        u.full_name,
        u.role,
        u.status
      FROM user_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.status = 'active'
      LIMIT 1;
    `, [tokenHash]);

    if (result.rowCount === 0) {
      req.auth = null;
      return next();
    }

    const row = result.rows[0];
    req.auth = {
      sessionId: row.session_id,
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
      expiresAt: row.expires_at
    };
    req.sessionToken = token;
    return next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req, _res, next) {
  if (!req.auth) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    error.code = 'AUTH_REQUIRED';
    return next(error);
  }
  return next();
}

export function requireRole(...roles) {
  const allowed = new Set(roles);
  return (req, _res, next) => {
    if (!req.auth) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      error.code = 'AUTH_REQUIRED';
      return next(error);
    }
    if (!allowed.has(req.auth.role)) {
      const error = new Error('Insufficient permissions');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      return next(error);
    }
    return next();
  };
}

export async function revokeCurrentSession(req) {
  if (!req.sessionToken) return false;
  const tokenHash = hashSessionToken(req.sessionToken);
  const result = await query(`
    UPDATE user_sessions
    SET revoked_at = NOW(), updated_at = NOW()
    WHERE token_hash = $1
      AND revoked_at IS NULL;
  `, [tokenHash]);
  return result.rowCount === 1;
}
