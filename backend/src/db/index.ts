import { envConfig } from '../config.js';
import { PostgresStore } from './postgresStore.js';
import { AppStore } from './store.js';
import { IAppStore } from './types.js';

export type { IAppStore } from './types.js';
export { AppStore } from './store.js';
export { PostgresStore } from './postgresStore.js';

/**
 * Automatically selects the best storage backend:
 * - If DATABASE_URL or POSTGRES_URL is set (e.g. Vercel Neon free tier, Supabase) -> PostgresStore
 * - Otherwise -> built-in SQLite (local disk or /tmp on Vercel before DB is connected)
 */
export function createStore(): IAppStore {
  const pgUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (pgUrl) {
    return new PostgresStore(pgUrl);
  }
  const dbPath =
    process.env.VERCEL && !process.env.DB_PATH ? '/tmp/trackmyhappiness.db' : envConfig.dbPath;
  return new AppStore(dbPath);
}
