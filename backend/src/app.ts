import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { healthRouter } from './routes/health.js';
import { ApiError, trainingRouter } from './routes/training.js';
import { progressRouter } from './routes/progress.js';
import { authRouter, protectedAccountRouter, requireOwner } from './auth/owner.js';
import { randomUUID } from 'node:crypto';

export const app = express();
app.disable('x-powered-by');
app.use((req,res,next) => {
  const id = randomUUID(),start = process.hrtime.bigint();res.setHeader('X-Request-ID',id);
  res.once('finish',() => { if (process.env.LOG_REQUESTS === '1') console.log(JSON.stringify({ event: 'request',id,method: req.method,route: req.route?.path ?? 'unmatched',status: res.statusCode,duration_ms: Math.round(Number(process.hrtime.bigint()-start)/1e6) })); });
  next();
});
if (process.env.NODE_ENV === 'production') app.set('trust proxy',1);
app.use((_req,res,next) => { res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');next(); });
app.use(express.json({ limit: '100kb' }));
app.get('/api/v1/health',(_req,res) => res.json({ status: 'ok',service: 'life-strong-api' }));
app.use('/api/v1/auth',authRouter);
app.use('/api/v1',requireOwner);
app.use('/api/v1/account',protectedAccountRouter);
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/progress', progressRouter);
app.use('/api/v1', trainingRouter);
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', issues: error.issues } }); return; }
  if (error instanceof ApiError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
  if (error.code === '23505') { res.status(409).json({ error: { code: 'CONFLICT', message: 'Record conflicts with an existing entry' } }); return; }
  if (error.code === '23503' || error.code === '23514' || error.code === '22008' || error.code === '22007') { res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'Invalid reference or value' } }); return; }
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') { res.status(error.status).json({ error: { code: 'INVALID_BODY', message: 'Invalid JSON body or request too large' } }); return; }
  console.error(JSON.stringify({ event: 'request_failed',method: _req.method,route: _req.route?.path ?? 'unmatched',code: typeof error.code === 'string' ? error.code : 'UNKNOWN' }));
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request failed' } });
};
app.use(errorHandler);
