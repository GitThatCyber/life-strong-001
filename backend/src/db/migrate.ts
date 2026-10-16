import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env before migrating');
  const directory = fileURLToPath(new URL('../../../database/migrations/', import.meta.url));
  const files = (await readdir(directory)).filter(name => /^\d+_[\w-]+\.sql$/.test(name)).sort();
  const client = await pool.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const filename of files) {
      await client.query('BEGIN');
      try {
        const previous = await client.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [filename]);
        if (previous.rowCount === 0) {
          await client.query(await readFile(resolve(directory, filename), 'utf8'));
          await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
          console.log(`Applied ${filename}`);
        } else console.log(`Skipped ${filename}`);
        await client.query('COMMIT');
      } catch (err) { await client.query('ROLLBACK'); throw err; }
    }
  } finally { client.release(); await pool.end(); }
}
migrate().catch(err => { console.error(err); process.exitCode = 1; });
