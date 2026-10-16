import 'dotenv/config';
import { app } from './app.js';
import { pool } from './db/pool.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const server = app.listen(port, host, () => console.log(`Life Strong API listening on http://${host}:${port}`));
let closing = false;
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,() => {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1),10000);
  timeout.unref();
  server.close(() => { void pool.end().then(() => process.exit(0)).catch(() => process.exit(1)); });
});
server.on('error',error => { console.error('API failed to listen:',error.message);void pool.end();process.exitCode = 1; });
