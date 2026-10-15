import crypto from 'node:crypto';

export const VNPAY_PAYMENT_URL = process.env.VNPAY_PAYMENT_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
export const VNPAY_VERSION = '2.1.0';

function encodeValue(value) {
  return encodeURIComponent(String(value)).replace(/%20/g, '+');
}

export function sortVnpayParams(input) {
  const keys = Object.keys(input)
    .filter((key) => input[key] !== undefined && input[key] !== null && String(input[key]) !== '')
    .sort((a, b) => encodeURIComponent(a).localeCompare(encodeURIComponent(b)));

  const output = {};
  for (const key of keys) {
    output[key] = encodeValue(input[key]);
  }
  return output;
}

export function buildVnpaySignData(input) {
  const sorted = sortVnpayParams(input);
  return Object.keys(sorted).map((key) => `${encodeURIComponent(key)}=${sorted[key]}`).join('&');
}

export function hmacSha512Hex(secret, signData) {
  return crypto.createHmac('sha512', secret).update(signData, 'utf8').digest('hex');
}

export function signVnpayParams(input, secret) {
  if (!secret) throw new Error('VNPAY hash secret is not configured');
  return hmacSha512Hex(secret, buildVnpaySignData(input));
}

export function buildVnpayPaymentUrl(params, secret, paymentUrl = VNPAY_PAYMENT_URL) {
  if (!secret) throw new Error('VNPAY hash secret is not configured');
  const sorted = sortVnpayParams(params);
  const signData = Object.keys(sorted).map((key) => `${encodeURIComponent(key)}=${sorted[key]}`).join('&');
  const secureHash = hmacSha512Hex(secret, signData);
  const query = `${Object.keys(sorted).map((key) => `${encodeURIComponent(key)}=${sorted[key]}`).join('&')}&vnp_SecureHash=${secureHash}`;
  return `${paymentUrl}?${query}`;
}

export function verifyVnpayResponse(input, secret) {
  const provided = String(input.vnp_SecureHash || '').toLowerCase();
  if (!secret || !/^[0-9a-f]{128}$/.test(provided)) return false;

  const payload = { ...input };
  delete payload.vnp_SecureHash;
  delete payload.vnp_SecureHashType;
  const expected = hmacSha512Hex(secret, buildVnpaySignData(payload)).toLowerCase();
  return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
}

export function formatVnpayDate(date = new Date(), timeZone = 'Asia/Ho_Chi_Minh') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + Number(minutes) * 60_000);
}

export function sanitizeIpAddress(rawIp) {
  const value = String(rawIp || '').trim();
  if (/^[0-9a-fA-F:.]+$/.test(value) && value.length >= 3 && value.length <= 45) return value;
  return '127.0.0.1';
}


export function vnpayAmountToVnd(value) {
  if (!/^\d+$/.test(String(value || ''))) return null;
  const raw = BigInt(value);
  if (raw % 100n !== 0n) return null;
  return raw / 100n;
}
