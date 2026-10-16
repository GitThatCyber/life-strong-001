import 'dotenv/config';
import { z } from 'zod';
import { pool } from './pool.js';
import { hashPassword } from '../auth/password.js';
try {
  const email = z.email().max(254).parse(process.env.OWNER_EMAIL).toLowerCase();
  const password = z.string().min(15).max(128).parse(process.env.OWNER_PASSWORD);
  const hash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query('UPDATE app_owner SET email=$1,password_hash=$2,disabled=false,updated_at=now() WHERE singleton',[email,hash]);
    if (updated.rowCount !== 1) throw new Error('Owner profile is missing');
    await client.query('DELETE FROM auth_sessions');
    await client.query('COMMIT');console.log('Private owner provisioned; previous sessions revoked. Remove OWNER_PASSWORD from persistent deployment configuration.');
  } catch (e) { await client.query('ROLLBACK');throw e; } finally { client.release(); }
} catch { console.error('Owner setup failed. Apply migration 004 and provide OWNER_EMAIL and OWNER_PASSWORD (15–128 characters) through the private environment.');process.exitCode = 1; }
finally { await pool.end(); }
