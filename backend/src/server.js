import { required, positiveInteger } from './config.js';
import { pool } from './db.js';
import { cache } from './cache.js';
import { createApp } from './app.js';

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
const port = positiveInteger('PORT', 3000);
if (port > 65535) throw new Error('PORT must be at most 65535');
const app = createApp({ pool, cache, jwtSecret, frontendOrigin: required('FRONTEND_ORIGIN'), cacheTtl: positiveInteger('PRODUCT_CACHE_TTL_SECONDS', 60) });
void cache.connect().catch((error) => console.error('Redis connection failed:', error.message));
const server = app.listen(port, () => console.log(`API listening on port ${port}`));
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    if (cache.isOpen) cache.destroy();
    await pool.end();
    clearTimeout(timeout);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
