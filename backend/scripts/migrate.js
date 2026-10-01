import { readdir, readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(724190)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const directory = new URL('../migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    const applied = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [name]);
    if (applied.rowCount) continue;
    await client.query(await readFile(new URL(name, directory), 'utf8'));
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    console.log(`Applied ${name}`);
  }
  await client.query('COMMIT');
  console.log('Database migrations complete');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
