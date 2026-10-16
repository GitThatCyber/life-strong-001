import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';

test('GET /api/v1/health returns status ok without database', async () => {
  const response = await request(app).get('/api/v1/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok', service: 'life-strong-api' });
});

test('unknown endpoint returns 404', async () => {
  const response = await request(app).get('/api/v1/does-not-exist');
  assert.equal(response.status, 404);
});
