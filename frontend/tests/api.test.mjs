import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/api/v1/';
const { apiRequest, apiGet, ApiError } = await import('../services/api.ts');

test('API client preserves operation IDs and uses stable errors for retries', async t => {
  const calls = [];
  let failure = true;
  t.mock.method(globalThis,'fetch',async (url,options) => {
    calls.push({ url,options });
    if (failure) { failure = false; throw new TypeError('Connection lost after send'); }
    return Response.json({ id: 'saved-session' });
  });
  const body = { template_id: 'template',operation_id: 'same-operation' };
  await assert.rejects(apiRequest('/sessions','POST',body),/Connection lost/);
  assert.deepEqual(await apiRequest('/sessions','POST',body),{ id: 'saved-session' });
  assert.equal(calls[0].options.body,calls[1].options.body);
  assert.equal(calls[0].url,'http://localhost:3000/api/v1/sessions');
  assert.equal(calls[0].options.method,'POST');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  t.mock.restoreAll();
  t.mock.method(globalThis,'fetch',async () => Response.json({ error: { code: 'SESSION_NOT_ACTIVE',message: 'Resume the session before adding sets' } },{ status: 409 }));
  await assert.rejects(apiGet('/sessions'),error => error instanceof ApiError && error.status === 409 && /Resume/.test(error.message));
  t.mock.restoreAll();
  t.mock.method(globalThis,'fetch',async () => new Response('Proxy error',{ status: 502 }));
  await assert.rejects(apiGet('/sessions'),/API returned HTTP 502/);
});
