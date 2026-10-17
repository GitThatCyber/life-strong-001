import { createHash, randomBytes } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { checkPassword } from './password.js';
export const authRouter = Router();
export const protectedAccountRouter = Router();
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const secure = (production: boolean,request: { secure: boolean }) => !production || request.secure;
const attempts = new Map<string,{ count: number; until: number }>();
let activeLogins = 0;
let activeOwnerRequests = 0;
authRouter.post('/login',async (req,res) => {
  const production = process.env.NODE_ENV === 'production';
  if (process.env.AUTH_MODE !== 'owner') { res.status(404).json({ error: { code: 'AUTH_DISABLED',message: 'Owner sign-in is not enabled in this environment' } });return; }
  if (!secure(production,req)) { res.status(400).json({ error: { code: 'HTTPS_REQUIRED',message: 'HTTPS is required' } });return; }
  const key = req.ip ?? 'unknown',now = Date.now();
  for (const [ip,value] of attempts) if (value.until<=now) attempts.delete(ip);
  const recent = attempts.get(key) ?? { count: 0,until: now+15*60*1000 };
  if (recent.count>=5 || activeLogins>=2 || (!attempts.has(key) && attempts.size>=1000)) {
    res.setHeader('Retry-After','900');res.status(429).json({ error: { code: 'RATE_LIMITED',message: 'Too many sign-in attempts. Try again later.' } });return;
  }
  attempts.set(key,{ ...recent,count: recent.count+1 });
  const input = z.object({ email: z.email().max(254).transform(v => v.toLowerCase()),password: z.string().min(1).max(128) }).strict().parse(req.body);
  activeLogins++;
  try {
    const owner = (await pool.query('SELECT * FROM app_owner WHERE singleton')).rows[0];
    if (!owner || owner.disabled || !owner.password_hash) { res.status(503).json({ error: { code: 'OWNER_SETUP_REQUIRED',message: 'Private owner account has not been provisioned' } });return; }
    const valid = await checkPassword(input.password,owner.password_hash);
    if (!valid || input.email !== owner.email) { res.status(401).json({ error: { code: 'INVALID_CREDENTIALS',message: 'Email or password is incorrect' } });return; }
    const token = randomBytes(32).toString('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize with credential rotation so an old password cannot create a
      // surviving session after rotation has revoked prior credentials.
      const current = (await client.query('SELECT password_hash,disabled FROM app_owner WHERE singleton FOR SHARE')).rows[0];
      if (current.disabled || current.password_hash !== owner.password_hash) {
        await client.query('ROLLBACK');res.status(401).json({ error: { code: 'INVALID_CREDENTIALS',message: 'Credentials changed. Sign in again.' } });return;
      }
      await client.query('DELETE FROM auth_sessions WHERE expires_at<=now()');
      const session = (await client.query("INSERT INTO auth_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '30 days') RETURNING expires_at",[tokenHash(token),owner.id])).rows[0];
      await client.query('COMMIT'); attempts.delete(key);
      res.setHeader('Cache-Control','no-store');res.json({ token,expires_at: session.expires_at,owner: { id: owner.id,email: owner.email } });
    } catch (e) { await client.query('ROLLBACK');throw e; } finally { client.release(); }
  } finally { activeLogins--; }
});
export const requireOwner: RequestHandler = async (req,res,next) => {
  if (process.env.AUTH_MODE !== 'owner') {
    if (process.env.NODE_ENV === 'production') { res.status(503).json({ error: { code: 'AUTH_REQUIRED',message: 'Production authentication is not configured' } });return; }
    next();return;
  }
  if (!secure(process.env.NODE_ENV === 'production',req)) { res.status(400).json({ error: { code: 'HTTPS_REQUIRED',message: 'HTTPS is required' } });return; }
  const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) { res.status(401).json({ error: { code: 'UNAUTHORIZED',message: 'Sign in to your private account' } });return; }
  if (activeOwnerRequests>=4) { res.setHeader('Retry-After','1');res.status(429).json({ error: { code: 'RATE_LIMITED',message: 'Too many concurrent requests. Retry shortly.' } });return; }
  activeOwnerRequests++;
  let client;
  try { client = await pool.connect(); } catch (e) { activeOwnerRequests--;throw e; }
  let ended = false;
  const finish = async (commit = true) => {
    if (ended) return;ended = true;
    try { await client.query(commit ? 'COMMIT' : 'ROLLBACK'); }
    finally { client.release();activeOwnerRequests--; }
  };
  try {
    await client.query('BEGIN');
    // Owner lock spans the request. Credential rotation/account deletion waits for
    // earlier authorized writes, so none can re-create records after deletion.
    const owner = (await client.query(`SELECT o.id,o.email,s.token_hash FROM auth_sessions s JOIN app_owner o ON o.id=s.owner_id
      WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT o.disabled AND o.singleton FOR SHARE OF o`,[tokenHash(token)])).rows[0];
    if (!owner) { await finish(false);res.status(401).json({ error: { code: 'UNAUTHORIZED',message: 'Sign in to your private account' } });return; }
    if (res.destroyed) { await finish(false);return; }
    res.locals.owner = owner;res.locals.authClient = client;res.locals.finishAuthorization = finish;
    res.once('finish',() => { void finish().catch(() => console.error('Authorization transaction cleanup failed')); });
    res.once('close',() => { void finish(res.writableFinished).catch(() => console.error('Authorization connection cleanup failed')); });
    next();
  } catch (e) { await finish(false);throw e; }

};
protectedAccountRouter.get('/me',(_req,res) => {
  if (!res.locals.owner) { res.status(404).json({ error: { code: 'AUTH_DISABLED',message: 'Owner sign-in is not enabled' } });return; }
  res.json({ id: res.locals.owner.id,email: res.locals.owner.email });
});
protectedAccountRouter.post('/logout',async (_req,res) => {
  if (res.locals.owner) await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1',[res.locals.owner.token_hash]);
  res.json({ status: 'signed_out' });
});

protectedAccountRouter.get('/export',async (_req,res) => {
  if (!res.locals.owner) { res.status(404).json({ error: { code: 'AUTH_DISABLED',message: 'Owner mode is required' } });return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const data: Record<string,unknown> = { exported_at: new Date().toISOString(),owner: { id: res.locals.owner.id,email: res.locals.owner.email } };
    for (const table of ['exercises','workout_templates','template_exercises','programs','program_schedule','user_programs','workout_sessions','session_exercises','exercise_sets']) {
      data[table] = (await client.query(`SELECT * FROM ${table}`)).rows;
    }
    await client.query('COMMIT');res.json(data);
  } catch (e) { await client.query('ROLLBACK');throw e; } finally { client.release(); }
});
protectedAccountRouter.delete('/',async (req,res) => {
  z.object({ confirmation: z.literal('DELETE MY ACCOUNT') }).strict().parse(req.body);
  if (!res.locals.authClient) { res.status(404).json({ error: { code: 'AUTH_DISABLED',message: 'Owner mode is required' } });return; }
  const client = res.locals.authClient;
  await client.query('SELECT id FROM app_owner WHERE singleton FOR UPDATE');
  for (const table of ['library_write_receipts','set_correction_receipts','exercise_sets','session_exercises','workout_sessions','user_programs','program_schedule','programs','template_exercises','workout_templates','exercises','seed_history','auth_sessions']) {
    await client.query(`DELETE FROM ${table}`);
  }
  await client.query('UPDATE app_owner SET email=NULL,password_hash=NULL,disabled=true,updated_at=now() WHERE singleton');
  await res.locals.finishAuthorization();
  res.json({ status: 'deleted',message: 'Owner account disabled and live training records deleted. Backups retain data until their retention period expires.' });
});
