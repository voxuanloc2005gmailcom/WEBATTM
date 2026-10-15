import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const PASSWORD_SALT_ROUNDS = 12;
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function requiredPositiveIntegerEnv(name, fallback, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 300 || value > max) {
    throw new Error(`${name} must be an integer between 300 and ${max}`);
  }
  return value;
}

export function getSessionTtlSeconds() {
  return requiredPositiveIntegerEnv(
    'SESSION_TTL_SECONDS',
    DEFAULT_SESSION_TTL_SECONDS,
    MAX_SESSION_TTL_SECONDS
  );
}

export async function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function getCookieName() {
  return process.env.SESSION_COOKIE_NAME || 'tg_session';
}

export function isCookieSecure() {
  const value = String(process.env.COOKIE_SECURE ?? 'false').toLowerCase();
  return value === 'true';
}

export function buildSessionCookie(token, maxAgeSeconds = getSessionTtlSeconds()) {
  const parts = [
    `${getCookieName()}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  if (isCookieSecure()) parts.push('Secure');
  return parts.join('; ');
}

export function buildExpiredSessionCookie() {
  const parts = [
    `${getCookieName()}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];
  if (isCookieSecure()) parts.push('Secure');
  return parts.join('; ');
}

export function parseCookieHeader(header) {
  const cookies = new Map();
  if (!header) return cookies;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies.set(name, decodeURIComponentSafe(value));
  }
  return cookies;
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function extractSessionToken(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieToken = cookies.get(getCookieName());
  if (cookieToken) return cookieToken;

  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9_-]{40,200})$/i);
  return match ? match[1] : null;
}
