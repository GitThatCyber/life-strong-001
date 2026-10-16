import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';

try {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before seeding');
  const sql = await readFile(new URL('../../../database/seeds/001_starter.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('life-strong-starter-seed',0))");
    const prior = await client.query('SELECT 1 FROM seed_history WHERE filename=$1', ['001_starter.sql']);
    if (prior.rowCount === 0) {
      await client.query(sql);
      await client.query('INSERT INTO seed_history(filename) VALUES($1)', ['001_starter.sql']);
    }
    await client.query('COMMIT');
    console.log(prior.rowCount ? 'Skipped 001_starter.sql (already seeded; edits preserved)' : 'Applied 001_starter.sql');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await pool.end(); }
