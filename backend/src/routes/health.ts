import { Router } from 'express';
import { pool } from '../db/pool.js';

export const healthRouter = Router();
healthRouter.get('/', (_req, res) => res.status(200).json({ status: 'ok', service: 'life-strong-api' }));
healthRouter.get('/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});
