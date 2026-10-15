import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  createSessionToken,
  getSessionTtlSeconds,
  hashPassword,
  hashSessionToken,
  verifyPassword
} from '../utils/auth.js';
import { parseLoginBody, parseRegisterBody } from '../utils/auth-validation.js';
import { loadAuthenticatedUser, requireAuth, revokeCurrentSession } from '../middleware/auth.js';

export const authRouter = Router();

const GENERIC_AUTH_ERROR = 'Invalid email or password';

// POST /auth/register
// Creates a customer account and an empty cart atomically.
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, fullName } = parseRegisterBody(req.body);
    const passwordHash = await hashPassword(password);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(`
        INSERT INTO users (email, password_hash, full_name)
        VALUES ($1, $2, $3)
        RETURNING id, email, full_name, role, status, created_at;
      `, [email, passwordHash, fullName]);

      const user = userResult.rows[0];
      await client.query(`
        INSERT INTO carts (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING;
      `, [user.id]);

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: {
          user: mapUser(user)
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') {
        error.statusCode = 409;
        error.code = 'EMAIL_ALREADY_REGISTERED';
        error.message = 'An account with this email already exists';
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// POST /auth/login
// Authentication is rate-limited at Nginx and uses a server-side session token.
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = parseLoginBody(req.body);

    const result = await query(`
      SELECT id, email, password_hash, full_name, role, status
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1;
    `, [email]);

    const user = result.rows[0];
    const passwordMatches = await verifyPassword(password, user?.password_hash);

    if (!user || !passwordMatches || user.status !== 'active') {
      const error = new Error(GENERIC_AUTH_ERROR);
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const ttlSeconds = getSessionTtlSeconds();
    const userAgent = String(req.get('user-agent') || '').slice(0, 500) || null;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await query(`
      INSERT INTO user_sessions (
        user_id,
        token_hash,
        user_agent,
        expires_at
      )
      VALUES ($1, $2, $3, $4);
    `, [user.id, tokenHash, userAgent, expiresAt]);

    res.setHeader('Set-Cookie', buildSessionCookie(token, ttlSeconds));
    res.status(200).json({
      success: true,
      data: {
        user: mapUser(user),
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout
// Revokes the current session server-side and clears the browser cookie.
authRouter.post('/logout', loadAuthenticatedUser, async (req, res, next) => {
  try {
    await revokeCurrentSession(req);
    res.setHeader('Set-Cookie', buildExpiredSessionCookie());
    res.status(200).json({
      success: true,
      data: { signedOut: true }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', loadAuthenticatedUser, requireAuth, async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.auth.userId,
        email: req.auth.email,
        fullName: req.auth.fullName,
        role: req.auth.role,
        status: req.auth.status
      },
      session: {
        expiresAt: req.auth.expiresAt
      }
    }
  });
});

function mapUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    status: user.status,
    ...(user.created_at ? { createdAt: user.created_at } : {})
  };
}
