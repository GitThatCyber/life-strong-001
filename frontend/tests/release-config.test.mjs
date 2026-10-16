import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const configure = createRequire(import.meta.url)('../app.config.js');
test('signed native build refuses example identifiers, HTTP APIs and disabled owner auth', () => {
  const names = ['EAS_BUILD_PROFILE','IOS_BUNDLE_IDENTIFIER','EXPO_PUBLIC_API_BASE_URL','EXPO_PUBLIC_AUTH_MODE'];
  const prior = Object.fromEntries(names.map(k => [k,process.env[k]]));
  try {
    process.env.EAS_BUILD_PROFILE='preview';delete process.env.IOS_BUNDLE_IDENTIFIER;
    assert.throws(configure,/IOS_BUNDLE_IDENTIFIER/);
    process.env.IOS_BUNDLE_IDENTIFIER='com.lifestrong.smoketest';
    process.env.EXPO_PUBLIC_API_BASE_URL='http://localhost:3000/api/v1';
    assert.throws(configure,/HTTPS/);
    process.env.EXPO_PUBLIC_API_BASE_URL='https://api.example.invalid/api/v1';process.env.EXPO_PUBLIC_AUTH_MODE='local';
    assert.throws(configure,/AUTH_MODE/);
    process.env.EXPO_PUBLIC_AUTH_MODE='owner';
    assert.equal(configure().ios.bundleIdentifier,'com.lifestrong.smoketest');
  } finally { for(const k of names)if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]; }
});
