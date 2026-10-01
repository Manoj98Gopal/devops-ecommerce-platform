import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export function required(name) {
  const value = process.env[name];
  if (!value || value.includes('REPLACE_WITH')) throw new Error(`Set ${name} in backend/.env`);
  return value;
}

export function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}
