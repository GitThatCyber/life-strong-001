import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
// A DATABASE_URL is mandatory for database operations, not for the basic health route.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
// Idle connections can fail while PostgreSQL restarts; keep the API alive to recover.
pool.on('error', () => console.error('PostgreSQL idle connection lost; database requests will retry on new connections.'));
