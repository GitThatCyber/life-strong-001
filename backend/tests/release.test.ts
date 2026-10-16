import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertReleaseConfiguration } from '../src/config/release.js';
test('incomplete release cannot start silently as production', () => {
  assert.throws(() => assertReleaseConfiguration({ NODE_ENV: 'production' }),/authentication and per-user authorization/);
  assert.throws(() => assertReleaseConfiguration({ NODE_ENV: 'production',AUTH_MODE: 'owner',DATABASE_URL: 'postgres://lifestrong_dev_password',PUBLIC_ORIGIN: 'https://example.com' }),/development password/);
  assert.throws(() => assertReleaseConfiguration({ NODE_ENV: 'production',AUTH_MODE: 'owner',DATABASE_URL: 'postgres://private',PUBLIC_ORIGIN: 'http://example.com' }),/HTTPS/);
  assert.doesNotThrow(() => assertReleaseConfiguration({ NODE_ENV: 'production',AUTH_MODE: 'owner',DATABASE_URL: 'postgres://private',PUBLIC_ORIGIN: 'https://example.com' }));
  assert.doesNotThrow(() => assertReleaseConfiguration({ NODE_ENV: 'test' }));
  assert.doesNotThrow(() => assertReleaseConfiguration({ NODE_ENV: 'development' }));
});
