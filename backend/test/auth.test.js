import test from 'node:test';
import assert from 'node:assert/strict';
import { query, pool } from '../src/db/pool.js';
import { hashPassword, PASSWORD_SALT_ROUNDS } from '../src/utils/auth.js';
import bcrypt from 'bcryptjs';

const baseUrl = (process.env.TEST_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `phase2-${unique}@example.com`;
const password = 'Str0ng!TechGear#2026';
const fullName = 'Phase 2 Test User';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie');
  assert.ok(raw, 'login must set a session cookie');
  return raw.split(';', 1)[0];
}

test('password hashing uses bcrypt with the required salt rounds', async () => {
  const hash = await hashPassword(password);
  assert.match(hash, /^\$2[ab]\$12\$/);
  assert.equal(hash.length, 60);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(PASSWORD_SALT_ROUNDS, 12);
});

test('register creates a customer account and cart without accepting an admin role', async () => {
  const { response, body } = await request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, fullName, role: 'admin' })
  });

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.user.email, email);
  assert.equal(body.data.user.role, 'customer');
  assert.equal(body.data.user.status, 'active');

  const userResult = await query('SELECT id, role, status FROM users WHERE LOWER(email) = $1', [email]);
  assert.equal(userResult.rowCount, 1);
  assert.equal(userResult.rows[0].role, 'customer');

  const cartResult = await query('SELECT id, status FROM carts WHERE user_id = $1', [userResult.rows[0].id]);
  assert.equal(cartResult.rowCount, 1);
  assert.equal(cartResult.rows[0].status, 'active');
});

test('duplicate registration returns a safe conflict response', async () => {
  const { response, body } = await request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, fullName })
  });
  assert.equal(response.status, 409);
  assert.equal(body.success, false);
  assert.equal(body.code, 'EMAIL_ALREADY_REGISTERED');
});

test('invalid credentials return 401 without account enumeration detail', async () => {
  const { response, body } = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'WrongPassword!2026' })
  });
  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.code, 'INVALID_CREDENTIALS');
  assert.equal(body.message, 'Invalid email or password');
});

test('login creates a server-side session and /me exposes only safe identity data', async () => {
  const { response, body } = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.user.role, 'customer');
  assert.equal(typeof body.data.expiresAt, 'string');
  assert.equal('passwordHash' in body.data.user, false);

  const cookie = cookieFrom(response);
  const me = await request('/api/v1/auth/me', {
    headers: { cookie }
  });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.success, true);
  assert.equal(me.body.data.user.email, email);
  assert.equal(me.body.data.user.role, 'customer');
  assert.equal('passwordHash' in me.body.data.user, false);

  const sessionResult = await query(`
    SELECT token_hash, revoked_at, expires_at
    FROM user_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE LOWER(u.email) = $1
    ORDER BY s.id DESC
    LIMIT 1;
  `, [email]);
  assert.equal(sessionResult.rowCount, 1);
  assert.equal(sessionResult.rows[0].token_hash.length, 64);
  assert.equal(sessionResult.rows[0].revoked_at, null);
});

test('customer cannot access an admin-protected endpoint', async () => {
  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const cookie = cookieFrom(login.response);

  const { response, body } = await request('/api/v1/admin/me', {
    headers: { cookie }
  });
  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.code, 'FORBIDDEN');
});

test('logout revokes the server-side session and clears the cookie', async () => {
  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const cookie = cookieFrom(login.response);

  const logout = await request('/api/v1/auth/logout', {
    method: 'POST',
    headers: { cookie }
  });
  assert.equal(logout.response.status, 200);
  assert.equal(logout.body.data.signedOut, true);

  const me = await request('/api/v1/auth/me', {
    headers: { cookie }
  });
  assert.equal(me.response.status, 401);
  assert.equal(me.body.code, 'AUTH_REQUIRED');
});

test('auth validation rejects weak passwords and malformed emails', async () => {
  const weak = await request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `weak-${unique}@example.com`, password: 'short', fullName })
  });
  assert.equal(weak.response.status, 400);
  assert.equal(weak.body.code, 'INVALID_PASSWORD');

  const malformed = await request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password, fullName })
  });
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.body.code, 'INVALID_EMAIL');
});

test.after(async () => {
  await query('DELETE FROM users WHERE LOWER(email) = $1', [email]);
  await pool.end();
});
