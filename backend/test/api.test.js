import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';

const logger = { info() {}, warn() {}, error() {} };
async function withApi(dependencies, run) {
  const server = createApp({ jwtSecret: 'test-only-secret-'.repeat(3), frontendOrigin: 'http://localhost:5173', logger, ...dependencies }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('health reports real dependency state', async () => {
  for (const ready of [true, false]) {
    await withApi({ pool: { query: async () => ({ rows: [] }) }, cache: { isReady: ready, ping: async () => 'PONG' } }, async (base) => {
      const response = await fetch(`${base}/api/health`);
      assert.equal(response.status, ready ? 200 : 503);
      assert.deepEqual((await response.json()).dependencies, { postgres: 'up', redis: ready ? 'up' : 'down' });
    });
  }
});

test('product cache hits skip PostgreSQL and writes use TTL', async () => {
  let queries = 0;
  let stored;
  const products = [{ id: '1', name: 'Mug', price_cents: 1299 }];
  await withApi({ pool: { query: async () => { queries++; return { rows: products }; } },
    cache: { isReady: true, get: async () => stored, set: async (_key, value, options) => { assert.equal(options.EX, 60); stored = value; } } }, async (base) => {
    const miss = await fetch(`${base}/api/products`);
    assert.equal(miss.headers.get('X-Cache'), 'MISS');
    assert.deepEqual((await miss.json()).products, products);
    assert.equal((await fetch(`${base}/api/products`)).headers.get('X-Cache'), 'HIT');
    assert.equal(queries, 1);
  });
});

test('Redis failures fall back to database; database errors stay private', async () => {
  const cache = { isReady: true, get: async () => { throw new Error('offline'); }, set: async () => { throw new Error('offline'); } };
  await withApi({ cache, pool: { query: async () => ({ rows: [] }) } }, async (base) => {
    assert.equal((await fetch(`${base}/api/products`)).status, 200);
  });
  await withApi({ cache, pool: { query: async () => { throw new Error('secret connection details'); } } }, async (base) => {
    const response = await fetch(`${base}/api/products`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Internal server error.' });
  });
});

test('login validates passwords and orders are scoped to the verified user', async () => {
  const password = 'test-fixture-password';
  const passwordHash = await bcrypt.hash(password, 4);
  const pool = { query: async (sql, params) => {
    if (sql.includes('FROM users')) {
      assert.deepEqual(params, ['test@example.com']);
      return { rows: [{ id: '7', email: 'test@example.com', password_hash: passwordHash }] };
    }
    assert.ok(sql.includes('WHERE o.user_id = $1'));
    assert.deepEqual(params, ['7']);
    return { rows: [] };
  } };
  await withApi({ pool, cache: { isReady: false } }, async (base) => {
    const login = (body) => fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await login({ email: 42, password })).status, 400);
    assert.equal((await login({ email: 'test@example.com', password: 'wrong' })).status, 401);
    assert.equal((await fetch(`${base}/api/orders`)).status, 401);
    assert.equal((await fetch(`${base}/api/orders`, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
    const response = await login({ email: 'TEST@example.com', password });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.password_hash, undefined);
    const orders = await fetch(`${base}/api/orders?user_id=999`, { headers: { Authorization: `Bearer ${body.token}` } });
    assert.equal(orders.status, 200);
    assert.deepEqual(await orders.json(), { orders: [] });
    const malformed = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  });
});
