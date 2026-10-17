# Life Strong

Life Strong is a personal fitness app. Gates 1–6 are accepted for the existing Expo/Express/PostgreSQL implementation. On October 17, 2026 the owner approved migration to **SwiftUI + local SwiftData + private CloudKit** to eliminate the dedicated API hosting requirement. AWS integration is deferred; do not follow the historical AWS setup guide for the new target.

Phase 7A development is implemented in [ios-native](ios-native/README.md): a separate SwiftUI/SwiftData rehearsal app with local-save/relaunch tests. Follow [Phase 7A end-to-end instructions](docs/phase-7a-testing.md). Physical iPhone and live CloudKit development acceptance remain pending; no native importer or CloudKit container has been created. The accepted TypeScript app and its data remain intact for real use until cutover.

Start with the [native migration plan](docs/swiftdata-migration-plan.md), [data migration contract](docs/data-migration-contract.md), [current architecture](docs/architecture.md) and [release checklist](docs/release-checklist.md). Phase 7 covers native foundation, safe import, feature parity, private sync and cutover. Native release must pass new acceptance gates; prior local gates do not establish native readiness.

## Existing application during migration

The commands below operate the accepted **legacy** implementation only. Continue using it until native cutover is verified. Preserve .env files, PostgreSQL volumes and Expo's device queue/drafts. Do not delete either app's storage or replay pending writes against a different endpoint.

[Phase 6 testing](docs/phase-6-testing.md) records accepted exercise, workout and program customization in Expo; earlier regression procedures remain in the Phase 3–5 documents. [Legacy API documentation](docs/phase-2-api.md) is a migration reference. No API deployment is needed for the approved SwiftData target.

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
