# Architecture — Phase 1

```text
React Native / Expo / TypeScript (iPhone)
             | GET /api/v1/health
             v
Node.js / Express / TypeScript (development Mac)
             | pg Pool
             v
PostgreSQL (local Docker container or native PostgreSQL)
```

- The mobile application talks only to the API, never directly to PostgreSQL.
- Route handlers are versioned (`/api/v1`), with a basic health endpoint and optional database check.
- SQL migrations are ordered, applied transactionally and recorded in `schema_migrations`.
- Workout templates, plans, sessions and exercise sets are distinct future domain entities.
- User identity, authorization and HTTPS are required before multi-user / remote access.
