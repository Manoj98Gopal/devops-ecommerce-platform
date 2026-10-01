import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { required } from '../src/config.js';

const email = required('SEED_USER_EMAIL').trim().toLowerCase();
const password = required('SEED_USER_PASSWORD');
if (password.length < 8 || Buffer.byteLength(password) > 72) throw new Error('Seed password must be 8–72 bytes');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const user = await client.query(`INSERT INTO users (email, password_hash) VALUES ($1, $2)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`, [email, await bcrypt.hash(password, 12)]);
  const products = [
    ['MUG-001', 'Everyday mug', 'A simple ceramic mug for your desk.', 1299],
    ['BOOK-001', 'Pocket notebook', 'Keep notes on commands, ideas, and experiments.', 799],
    ['BAG-001', 'Canvas tote', 'A reusable bag for daily essentials.', 1899],
  ];
  const productIds = [];
  for (const product of products) {
    const result = await client.query(`INSERT INTO products (sku, name, description, price_cents) VALUES ($1, $2, $3, $4)
      ON CONFLICT (sku) DO NOTHING RETURNING id`, product);
    productIds.push(result.rows[0]?.id ?? (await client.query('SELECT id FROM products WHERE sku = $1', [product[0]])).rows[0].id);
  }
  const order = await client.query(`INSERT INTO orders (user_id, seed_key, status) VALUES ($1, $2, 'delivered')
    ON CONFLICT (seed_key) DO NOTHING RETURNING id`, [user.rows[0].id, `demo-order:${email}`]);
  if (order.rowCount) {
    await client.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES ($1, $2, 1, $3), ($1, $4, 2, $5)',
      [order.rows[0].id, productIds[0], products[0][3], productIds[1], products[1][3]]);
  }
  await client.query('COMMIT');
  console.log(`Seed complete for ${email}. Products are cached for up to PRODUCT_CACHE_TTL_SECONDS.`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
