import { createClient } from 'redis';
import { required } from './config.js';

export const cache = createClient({
  url: required('REDIS_URL'),
  socket: { connectTimeout: 2000, reconnectStrategy: (retries) => Math.min(250 * (retries + 1), 5000) },
  disableOfflineQueue: true,
});
cache.on('error', (error) => console.error('Redis error:', error.message));
