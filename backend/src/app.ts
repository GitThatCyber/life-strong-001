import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { healthRouter } from './routes/health.js';
import { ApiError, trainingRouter } from './routes/training.js';
import { progressRouter } from './routes/progress.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
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
  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request failed' } });
};
app.use(errorHandler);
