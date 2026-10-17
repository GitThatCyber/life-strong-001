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

test('owner credentials travel only as bearer headers and stale failures do not clear a newer sign-in', async t => {
  const { getAccessToken,setAccessToken } = await import('../services/accessToken.ts');
  const previous = process.env.EXPO_PUBLIC_AUTH_MODE;process.env.EXPO_PUBLIC_AUTH_MODE='owner';
  try {
    setAccessToken('old-token');
    t.mock.method(globalThis,'fetch',async (_url,options) => {
      assert.equal(options.headers.Authorization,'Bearer old-token');
      assert.equal(options.body,undefined);
      setAccessToken('new-token');
      return Response.json({ error: { message: 'Expired' } },{ status: 401 });
    });
    await assert.rejects(apiGet('/sessions'),/Expired/);
    assert.equal(getAccessToken(),'new-token');
  } finally {
    setAccessToken(null);
    if(previous===undefined)delete process.env.EXPO_PUBLIC_AUTH_MODE;else process.env.EXPO_PUBLIC_AUTH_MODE=previous;
  }
});

test('successful library archive accepts an empty 204 response', async t => {
  t.mock.method(globalThis,'fetch',async (_url,options) => {
    assert.equal(options.method,'DELETE');
    assert.deepEqual(JSON.parse(options.body),{ expected_revision: 2 });
    return new Response(null,{ status: 204 });
  });
  assert.equal(await apiRequest('/exercises/fixture','DELETE',{ expected_revision: 2 }),undefined);
});
