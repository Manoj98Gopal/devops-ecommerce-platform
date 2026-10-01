import pg from 'pg';
import { required } from './config.js';

export const pool = new pg.Pool({
  connectionString: required('DATABASE_URL'),
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  statement_timeout: 5000,
});
pool.on('error', (error) => console.error('PostgreSQL pool error:', error.message));
