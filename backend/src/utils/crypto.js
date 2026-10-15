import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION = Buffer.from('TG1', 'ascii');

function getAesKey() {
  const raw = String(process.env.AES_KEY || '').trim();
  if (!raw) {
    const error = new Error('AES encryption key is not configured');
    error.code = 'AES_KEY_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  let key;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    const error = new Error('AES encryption key is invalid');
    error.code = 'AES_KEY_INVALID';
    error.statusCode = 503;
    throw error;
  }

  if (key.length !== 32) {
    const error = new Error('AES encryption key must decode to 32 bytes');
    error.code = 'AES_KEY_INVALID';
    error.statusCode = 503;
    throw error;
  }
  return key;
}

export function encryptSensitive(plaintext) {
  const value = String(plaintext ?? '');
  if (!value) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getAesKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([VERSION, iv, authTag, ciphertext]);
}

export function decryptSensitive(payload) {
  if (!payload) return null;
  const input = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (input.length < VERSION.length + IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Encrypted value is malformed');
  }
  if (!input.subarray(0, VERSION.length).equals(VERSION)) {
    throw new Error('Encrypted value version is unsupported');
  }

  const ivStart = VERSION.length;
  const tagStart = ivStart + IV_LENGTH;
  const ciphertextStart = tagStart + AUTH_TAG_LENGTH;
  const iv = input.subarray(ivStart, tagStart);
  const authTag = input.subarray(tagStart, ciphertextStart);
  const ciphertext = input.subarray(ciphertextStart);

  const decipher = crypto.createDecipheriv(ALGORITHM, getAesKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function isAesKeyConfigured() {
  try {
    getAesKey();
    return true;
  } catch {
    return false;
  }
}
