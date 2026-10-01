import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const PRODUCTS_CACHE_KEY = 'ecommerce:products:v1';

export function createApp({ pool, cache, jwtSecret, frontendOrigin, cacheTtl = 60, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: frontendOrigin }));
  app.use(express.json({ limit: '10kb' }));
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => logger.info(JSON.stringify({ method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started })));
    next();
  });

  app.get('/api/health', async (_req, res) => {
    const checks = await Promise.allSettled([
      pool.query('SELECT 1'),
      cache.isReady ? cache.ping() : Promise.reject(new Error('Redis unavailable')),
    ]);
    const dependencies = { postgres: checks[0].status === 'fulfilled' ? 'up' : 'down', redis: checks[1].status === 'fulfilled' ? 'up' : 'down' };
    const healthy = Object.values(dependencies).every((value) => value === 'up');
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', dependencies });
  });

  app.get('/api/products', async (_req, res) => {
    if (cache.isReady) {
      try {
        const cached = await cache.get(PRODUCTS_CACHE_KEY);
        if (cached) return res.set('X-Cache', 'HIT').json({ products: JSON.parse(cached) });
      } catch (error) { logger.warn('Product cache read failed:', error.message); }
    }
    const { rows } = await pool.query('SELECT id, sku, name, description, price_cents FROM products ORDER BY id');
    if (cache.isReady) {
      try { await cache.set(PRODUCTS_CACHE_KEY, JSON.stringify(rows), { EX: cacheTtl }); }
      catch (error) { logger.warn('Product cache write failed:', error.message); }
    }
    res.set('X-Cache', 'MISS').json({ products: rows });
  });

  app.post('/api/login', rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in a minute.' } }), async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 ||
        typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: 'Provide a valid email and password (maximum 72 bytes).' });
    }
    const { rows } = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
    const token = jwt.sign({}, jwtSecret, { algorithm: 'HS256', subject: String(user.id), expiresIn: '1h', issuer: 'ecommerce-api', audience: 'ecommerce-web' });
    res.set('Cache-Control', 'no-store').json({ token, user: { id: user.id, email: user.email }, expiresIn: 3600 });
  });

  app.get('/api/orders', async (req, res) => {
    const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/);
    let userId;
    try {
      if (!bearer) throw new Error('Missing token');
      const payload = jwt.verify(bearer[1], jwtSecret, { algorithms: ['HS256'], issuer: 'ecommerce-api', audience: 'ecommerce-web' });
      if (typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)) throw new Error('Invalid subject');
      userId = payload.sub;
    } catch { return res.status(401).json({ error: 'Please log in again.' }); }
    const { rows } = await pool.query(`SELECT o.id, o.status, o.created_at,
      COALESCE(SUM(i.quantity * i.unit_price_cents), 0)::integer AS total_cents,
      COALESCE(json_agg(json_build_object('product_id', p.id, 'name', p.name, 'quantity', i.quantity,
        'unit_price_cents', i.unit_price_cents)) FILTER (WHERE i.product_id IS NOT NULL), '[]') AS items
      FROM orders o LEFT JOIN order_items i ON i.order_id = o.id LEFT JOIN products p ON p.id = i.product_id
      WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC, o.id DESC`, [userId]);
    res.set('Cache-Control', 'no-store').json({ orders: rows });
  });

  app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large.' });
    logger.error('Request failed:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  });
  return app;
}
