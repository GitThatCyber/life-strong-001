# Life Strong

General fitness tracker. Gates 1–5 are accepted for trusted local single-user use. Phase 5 progress, accessibility and reliability acceptance is complete. Private native release preparation is implemented; cloud setup, owner-mode phone acceptance, dependency review and signing remain open. See [private release runbook](docs/private-release-runbook.md). Stack: Expo / React Native / TypeScript → Express REST API → PostgreSQL.

Phase 6 native customization is implemented, with iPhone acceptance pending. Follow [Phase 6 setup and acceptance](docs/phase-6-testing.md) to back up, migrate and test exercise/workout/program editors.

For the repeatable end-to-end regression sequence, follow [Phase 5 testing](docs/phase-5-testing.md) and review the [release checklist](docs/release-checklist.md). Earlier regression procedures remain in [Phase 4 testing](docs/phase-4-testing.md) and [Phase 3 testing](docs/phase-3-testing.md). API resources and metrics are documented in [API documentation](docs/phase-2-api.md).

## Requirements
- Node.js 22+ and npm
- Docker Desktop **or** local PostgreSQL 17+
- macOS / iPhone with Expo Go (SDK compatibility required), or Xcode iOS simulator

## 1. Configure environment
From repo root:

```bash
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
```

For a physical iPhone, change `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env` to `http://YOUR_MAC_LAN_IP:3000/api/v1`. Both devices must be on the same LAN; Mac firewall must allow the API process. `localhost` on iPhone refers to iPhone, not Mac. For an iOS simulator, use `http://localhost:3000/api/v1`.

**Warning:** HTTP and hardcoded development database credentials are for a trusted local development network only. Do not expose port 3000 to the Internet. Use HTTPS and authentication before remote deployment. On iOS, HTTP access may need an appropriate development network security configuration depending on build/runtime policy.

## 2. Start database

```bash
docker compose up -d postgres
```

Or create the `lifestrong` role/database locally and adjust `backend/.env`.

Docker exposes PostgreSQL at `localhost:5433`; the backend environment example matches this port. Existing `.env` files are preserved by the copy commands above. Check an existing backend `DATABASE_URL` against your actual database setup.

## 3. Install and migrate

```bash
cd backend
npm ci
npm run migrate
npm test
npm run typecheck
npm run dev
```

API sanity checks in another terminal:

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/db
```

Expected responses: `{ "status": "ok", "service": "life-strong-api" }` and `{ "status": "ok", "database": "connected" }`.

## 4. Start iOS app

```bash
cd frontend
npm ci
npm run typecheck
npm start
```

Use Expo Go on your iPhone, or press `i` in Expo CLI for the iOS simulator. Tap **Test API Connection**. Expected: `API reachable ✓`.

Use `npm run doctor` to check Expo compatibility. Preserve the validated frontend manifest and lockfile; use `npx expo install --fix` only to resolve a confirmed compatibility issue, then review the resulting changes.

## Definition of done
1. PostgreSQL container healthy; Phase 1 migration applied once (re-run must skip).
2. Backend test and typecheck succeed.
3. `GET /api/v1/health` returns 200.
4. `GET /api/v1/health/db` returns 200 while DB is accessible.
5. iOS app opens and **Test API Connection** succeeds.

## Phase boundaries
Phase 2 adds exercises, templates, programs/schedules and session/history APIs. Phase 3 adds guided workout entry and timers. Phase 4 adds local notifications, persistent drafts and an ordered retry queue. Phase 5 adds timezone-aware completed-session progress, weekly frequency, records/trends, program activation/adherence, accessibility labels and backup restoration checks. New sessions require a connection; synchronization requires the app running while connected. The seeded program remains illustrative. Authentication, public deployment and remaining product gaps are tracked in the release checklist.

See `docs/architecture.md`, `docs/phase-1-testing.md`, and `docs/next-steps.md`.

## Source control and lightweight transfers

Keep the frontend and backend lockfiles in Git. Install dependencies with `npm ci` in each package; the root package only provides commands and needs no dependency installation. Ignore rules exclude local environment files, installed dependencies, caches, build output, and Finder metadata. Environment examples remain included.

Run `npm run archive` to create a source archive in `archives/` using Git's tracked and unignored file list, including uncommitted source files and environment examples. Git must be initialized. Keep secrets out of tracked source files; this command is not a secret scanner. The archive excludes Git history and, under the supplied ignore rules, local environment files and dependencies. It is a source handoff, not a database backup. Recipients install dependencies and configure their own environment. Keep installed dependencies locally for development rather than manually trimming package contents.
