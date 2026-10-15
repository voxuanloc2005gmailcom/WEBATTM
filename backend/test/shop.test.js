import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db/pool.js';
import { pool } from '../src/db/pool.js';

const baseUrl = (process.env.TEST_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emailA = `phase3-a-${unique}@example.com`;
const emailB = `phase3-b-${unique}@example.com`;
const password = 'Str0ng!TechGear#2026';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie');
  assert.ok(raw, 'login must set a session cookie');
  return raw.split(';', 1)[0];
}

async function registerAndLogin(email, fullName) {
  const reg = await request('/api/v1/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, fullName })
  });
  assert.equal(reg.response.status, 201);
  const login = await request('/api/v1/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  assert.equal(login.response.status, 200);
  return cookieFrom(login.response);
}

let cookieA;
let orderId;
let originalStock;


test('cart requires authentication', async () => {
  const cart = await request('/api/v1/cart');
  assert.equal(cart.response.status, 401);
  assert.equal(cart.body.code, 'AUTH_REQUIRED');
});

 test('authenticated user can view an isolated empty cart', async () => {
  cookieA = await registerAndLogin(emailA, 'Phase 3 Customer A');
  const cart = await request('/api/v1/cart', { headers: { cookie: cookieA } });
  assert.equal(cart.response.status, 200);
  assert.equal(cart.body.success, true);
  assert.equal(cart.body.data.items.length, 0);
});

test('adding to cart uses server-side stock and price', async () => {
  const stock = await query('SELECT stock_quantity FROM products WHERE id = 1');
  originalStock = stock.rows[0].stock_quantity;
  const add = await request('/api/v1/cart/items', {
    method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 1, quantity: 2, price: 1 })
  });
  assert.equal(add.response.status, 201);
  assert.equal(add.body.data.quantity, 2);
  const cart = await request('/api/v1/cart', { headers: { cookie: cookieA } });
  assert.equal(cart.body.data.items[0].product.id, '1');
  assert.equal(cart.body.data.items[0].product.price, 2490000);
  assert.equal(cart.body.data.subtotal, 4980000);
});

test('cannot add more units than current stock', async () => {
  const add = await request('/api/v1/cart/items', {
    method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 1, quantity: 999 })
  });
  assert.equal(add.response.status, 409);
  assert.equal(add.body.code, 'INSUFFICIENT_STOCK');
});

test('checkout creates an order, snapshots real prices, and encrypts PII', async () => {
  const checkout = await request('/api/v1/checkout', {
    method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({
      recipientName: 'Nguyen Van A',
      recipientPhone: '0901234567',
      shippingAddress: '123 Nguyen Hue, District 1, Ho Chi Minh City'
    })
  });
  assert.equal(checkout.response.status, 201);
  orderId = checkout.body.data.order.id;
  assert.equal(checkout.body.data.order.status, 'payment_pending');
  assert.equal(checkout.body.data.order.grandTotal, 4980000);

  const dbOrder = await query(`
    SELECT recipient_phone_encrypted, shipping_address_encrypted, grand_total
    FROM orders WHERE id = $1 AND user_id = (SELECT id FROM users WHERE email = $2);
  `, [orderId, emailA]);
  assert.equal(dbOrder.rowCount, 1);
  assert.ok(Buffer.isBuffer(dbOrder.rows[0].recipient_phone_encrypted));
  assert.ok(Buffer.isBuffer(dbOrder.rows[0].shipping_address_encrypted));
  assert.notEqual(dbOrder.rows[0].recipient_phone_encrypted.toString('utf8'), '0901234567');
  assert.notEqual(dbOrder.rows[0].shipping_address_encrypted.toString('utf8'), '123 Nguyen Hue, District 1, Ho Chi Minh City');
  assert.equal(Number(dbOrder.rows[0].grand_total), 4980000);

  const stock = await query('SELECT stock_quantity FROM products WHERE id = 1');
  assert.equal(stock.rows[0].stock_quantity, originalStock - 2);

  const reusableCartAfterCheckout = await request('/api/v1/cart', { headers: { cookie: cookieA } });
  assert.equal(reusableCartAfterCheckout.response.status, 200);
  assert.equal(reusableCartAfterCheckout.body.data.status, 'active');
  assert.equal(reusableCartAfterCheckout.body.data.items.length, 0);

  const addAfterCheckout = await request('/api/v1/cart/items', {
    method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 2, quantity: 1 })
  });
  assert.equal(addAfterCheckout.response.status, 201);

  const cartAfterReuse = await request('/api/v1/cart', { headers: { cookie: cookieA } });
  assert.equal(cartAfterReuse.response.status, 200);
  assert.equal(cartAfterReuse.body.data.items.length, 1);

  // Remove the follow-up cart item before the cancellation test restores stock.
  await request(`/api/v1/cart/items/${addAfterCheckout.body.data.id}`, {
    method: 'DELETE', headers: { cookie: cookieA }
  });
});

test('order detail is owner-scoped and decrypts only the requesting user data', async () => {
  const own = await request(`/api/v1/orders/${orderId}`, { headers: { cookie: cookieA } });
  assert.equal(own.response.status, 200);
  assert.equal(own.body.data.recipient.phone, '0901234567');
  assert.equal(own.body.data.recipient.shippingAddress, '123 Nguyen Hue, District 1, Ho Chi Minh City');
  assert.equal(own.body.data.items[0].unitPrice, 2490000);
});

test('another customer cannot access the first customer order (IDOR protection)', async () => {
  const cookieB = await registerAndLogin(emailB, 'Phase 3 Customer B');
  const other = await request(`/api/v1/orders/${orderId}`, { headers: { cookie: cookieB } });
  assert.equal(other.response.status, 404);
  assert.equal(other.body.code, 'ORDER_NOT_FOUND');
});

test('customer can list only their own orders', async () => {
  const orders = await request('/api/v1/orders', { headers: { cookie: cookieA } });
  assert.equal(orders.response.status, 200);
  assert.equal(orders.body.data.length >= 1, true);
  assert.ok(orders.body.data.some((order) => String(order.id) === String(orderId)));
});

test('customer can cancel an unpaid order and stock is restored', async () => {
  const cancel = await request(`/api/v1/orders/${orderId}/cancel`, {
    method: 'POST', headers: { cookie: cookieA }
  });
  assert.equal(cancel.response.status, 200);
  assert.equal(cancel.body.data.status, 'cancelled');
  const stock = await query('SELECT stock_quantity FROM products WHERE id = 1');
  assert.equal(stock.rows[0].stock_quantity, originalStock);

  const detail = await request(`/api/v1/orders/${orderId}`, { headers: { cookie: cookieA } });
  assert.equal(detail.body.data.status, 'cancelled');
  assert.equal(detail.body.data.payment.status, 'cancelled');

  const reusableCart = await request('/api/v1/cart', { headers: { cookie: cookieA } });
  assert.equal(reusableCart.response.status, 200);
  assert.equal(reusableCart.body.data.items.length, 0);

  const addAfterCheckout = await request('/api/v1/cart/items', {
    method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 2, quantity: 1 })
  });
  assert.equal(addAfterCheckout.response.status, 201);
  await request(`/api/v1/cart/items/${addAfterCheckout.body.data.id}`, {
    method: 'DELETE', headers: { cookie: cookieA }
  });
});

test.after(async () => {
  if (orderId) {
    await query('DELETE FROM payments WHERE order_id = $1', [orderId]);
    await query('DELETE FROM orders WHERE id = $1', [orderId]);
  }

  await query(
    'DELETE FROM users WHERE LOWER(email) IN ($1, $2)',
    [emailA, emailB]
  );

  await pool.end();
});