// Production deployment is restricted to the explicitly configured private owner.
export function assertReleaseConfiguration(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== 'production') return;
  if (env.AUTH_MODE !== 'owner') throw new Error('Production requires private owner authentication and per-user authorization. Set AUTH_MODE=owner.');
  if (!env.DATABASE_URL || env.DATABASE_URL.includes('lifestrong_dev_password')) throw new Error('Production requires a private DATABASE_URL without the development password.');
  if (!env.PUBLIC_ORIGIN || new URL(env.PUBLIC_ORIGIN).protocol !== 'https:') throw new Error('PUBLIC_ORIGIN must be an HTTPS URL.');
}
