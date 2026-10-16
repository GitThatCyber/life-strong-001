const base = require('./app.json').expo;
module.exports = () => {
  const release = ['preview','production'].includes(process.env.EAS_BUILD_PROFILE);
  const bundle = process.env.IOS_BUNDLE_IDENTIFIER || base.ios.bundleIdentifier;
  const api = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (release) {
    if (!process.env.IOS_BUNDLE_IDENTIFIER || !bundle || bundle.startsWith('com.example.') || !/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(bundle)) throw new Error('Set a final IOS_BUNDLE_IDENTIFIER before a signed release build.');
    if (!api || new URL(api).protocol !== 'https:') throw new Error('A signed release build requires an HTTPS EXPO_PUBLIC_API_BASE_URL.');
    if (process.env.EXPO_PUBLIC_AUTH_MODE !== 'owner') throw new Error('A signed release build requires EXPO_PUBLIC_AUTH_MODE=owner.');
  }
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || base.extra?.eas?.projectId;
  return { ...base,ios: { ...base.ios,bundleIdentifier: bundle },...(projectId ? { extra: { ...base.extra,eas: { projectId } } } : {}) };
};
