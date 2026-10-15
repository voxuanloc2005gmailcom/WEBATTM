import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = (process.env.TEST_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

async function request(path, options) {
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

test('health reports backend and database availability', async () => {
  const { response, body } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.database, 'ok');
});

test('public catalog routes remain accessible without authentication', async () => {
  const categories = await request('/api/categories');
  assert.equal(categories.response.status, 200);

  const products = await request('/api/products?page=1&pageSize=1');
  assert.equal(products.response.status, 200);
});

test('categories returns active categories', async () => {
  const { response, body } = await request('/api/categories');
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 1);
  assert.ok(body.data.every((item) => item.slug && item.name));
});

test('products returns paginated catalog data', async () => {
  const { response, body } = await request('/api/products?page=1&pageSize=5&sort=price_asc');
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length <= 5);
  assert.equal(body.pagination.page, 1);
  assert.equal(body.pagination.pageSize, 5);
  assert.ok(Number.isInteger(body.pagination.totalItems));
  if (body.data.length > 1) {
    assert.ok(body.data[0].price <= body.data[1].price);
  }
});

test('product search is parameterized and does not execute SQL syntax', async () => {
  const payload = encodeURIComponent("' OR 1=1 --");
  const { response, body } = await request(`/api/products?category=keyboard&search=${payload}&pageSize=10`);
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.pagination.totalItems, 0);
});

test('product detail returns the catalog record by id', async () => {
  const list = await request('/api/products?page=1&pageSize=1');
  assert.equal(list.response.status, 200);
  assert.equal(list.body.success, true);
  assert.ok(list.body.data.length >= 1);

  const id = list.body.data[0].id;
  const { response, body } = await request(`/api/products/${id}`);
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.id, id);
  assert.ok(Array.isArray(body.data.images));
});

test('invalid page size is rejected', async () => {
  const { response, body } = await request('/api/products?pageSize=101');
  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, 'INTEGER_OUT_OF_RANGE');
});

test('invalid product id is rejected', async () => {
  const { response, body } = await request('/api/products/not-an-id');
  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, 'INVALID_ID');
});

test('missing product returns 404 without internal detail', async () => {
  const { response, body } = await request('/api/products/999999999');
  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.code, 'PRODUCT_NOT_FOUND');
  assert.equal(typeof body.stack, 'undefined');
});

test('unsupported sort is rejected', async () => {
  const { response, body } = await request('/api/products?sort=price;DROP%20TABLE');
  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, 'INVALID_SORT');
});
