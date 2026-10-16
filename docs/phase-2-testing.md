# Phase 2 setup and acceptance

Phase 2 adds the local single-user training database, validated REST APIs, repeatable illustrative seed data, and an iPhone library browser. Guided mobile workout entry and rest timers are Phase 3. The original 12-week MTB prescriptions were not supplied: the seeded program repeats illustrative strength/endurance templates across 12 weeks and must not be treated as the original training plan.

Gate 1 is accepted. Gate 2 was accepted by the user on October 16, 2026 after the end-to-end verification sequence. Automated PostgreSQL/API acceptance uses a unique temporary schema and never resets the application schema.

## 1 Prepare and back up

Open Docker Desktop. In Terminal A:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
docker compose up -d postgres
docker compose ps
```

Wait for `healthy`. Keep the API stopped while migrating: press Control+C in its terminal first. From the project root, save a backup of the Docker development database:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U lifestrong -d lifestrong -Fc > backups/before-phase-2.dump
test -s backups/before-phase-2.dump
docker compose exec -T postgres pg_restore --list < backups/before-phase-2.dump
```

Expected: successful commands and a PostgreSQL archive listing. Do not proceed after a backup error. Use a new backup filename on subsequent upgrades to retain earlier backups. If your backend uses a separate native PostgreSQL instance, back up that actual database instead of the Docker database. Do not delete Docker volumes.

Preserve backend/frontend `.env` files. Docker's backend `DATABASE_URL` uses host port 5433; the iPhone frontend URL uses your Mac's current LAN IP and API port 3000. Keep `HOST=0.0.0.0` for the API. Do not share `.env` contents.

## 2 Install, migrate and seed

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm run db:migrate
npm run db:migrate
npm run db:seed
npm run db:seed
```

Expected: first migration applies `002_training.sql`; second skips it. First seed applies `001_starter.sql`; second skips it. Existing records and subsequent edits are preserved. No dependency upgrades are required for this phase.

Check the resulting records:

```bash
docker compose exec postgres psql -U lifestrong -d lifestrong \
  -c "SELECT filename FROM schema_migrations ORDER BY filename;" \
  -c "SELECT name, measurement_type FROM exercises ORDER BY name;" \
  -c "SELECT name, weeks FROM programs;" \
  -c "SELECT count(*) FROM program_schedule;"
```

On a fresh seed, expect two migrations, four exercises, one 12-week illustrative program, two workout templates, and 24 schedule entries. Custom data can increase counts.

## 3 Run automated checks

```bash
npm run check:api
npm run check:ios
npm run test:api
npm run test:integration
```

Expected: both typechecks pass, two health tests pass, and PostgreSQL acceptance passes. `test:api` intentionally skips the database suite; `test:integration` explicitly runs it. The database user must have permission to create a schema. The integration suite creates a randomly named schema, uses real migrations/seeds and HTTP requests, and removes only its own test schema afterward. It covers CRUD, invalid input/references, transactions, activation/schedules, retry-safe session/set creation, measurement validation, pause/resume/completion, corrections, and session history preserved after source edits. It also runs the real smoke-test script against an isolated HTTP server.

## 4 Start and exercise the API

In Terminal A:

```bash
npm run dev:api
```

Keep it running. In Terminal B:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
curl -i http://localhost:3000/api/v1/health/db
curl -i http://localhost:3000/api/v1/exercises
curl -i http://localhost:3000/api/v1/programs
npm run verify:phase2
```

Expected: HTTP 200, exercise/program data, and a `PASS` line with a session ID. The smoke command browses a program and template, starts a session, retries the same creation, logs one set, retries it without duplication, pauses/resumes, completes, retrieves, and checks history. Each run adds one real completed development session with illustrative set values. A failed run may leave a partial session. No source templates or programs are changed by this command.

To retrieve the recorded session, replace `SESSION_ID` with its printed ID:

```bash
curl -i http://localhost:3000/api/v1/sessions/SESSION_ID
curl -i http://localhost:3000/api/v1/sessions
```

Expected: completed status, an exercise snapshot, and one recorded set. For an API on another local port, run `LIFE_STRONG_API_URL=http://127.0.0.1:3001/api/v1 npm run verify:phase2`.

## 5 Verify on iPhone

1. Confirm the iPhone and Mac use the same private Wi-Fi. Keep the API terminal running.
2. Check `frontend/.env`: `EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_LAN_IP:3000/api/v1`. The last verified Mac IP was `10.0.0.85`; it may change. Never use localhost for a physical phone.
3. In iPhone Firefox, open `http://YOUR_MAC_LAN_IP:3000/api/v1/programs`. Expect program JSON. Firefox was previously successful when Safari failed.
4. Ensure Expo Go has Local Network permission on the iPhone.
5. In Terminal B, run `npm run dev:ios -- --clear` and scan the QR code in Expo Go. Restart Expo whenever the API URL changes.
6. Tap Test API Connection; expect API reachable.
7. Tap Browse programs and exercises. Expect the illustrative program, both templates, and all four seeded exercises.
8. Tap the program to inspect weeks 1–12 and scheduled workouts. Tap a workout template to inspect exercise names, prescriptions, and rest defaults.
9. Stop the API with Control+C. Tap Refresh library: expect a visible connection error. Restart the API, then refresh: expect recovery without restarting Expo. Previously loaded data can remain visible alongside the error.

If programs/exercises return HTTP 500, first confirm the Phase 2 migration ran against the same database used by the API. A working health route alone does not establish that feature tables exist.

## Gate 2 acceptance record

Accepted October 16, 2026, by explicit user confirmation. The checklist is recorded as accepted on that basis; individual device-test logs were not independently captured.

- [x] Backup verified; migration and seed commands repeat without duplicate data.
- [x] Backend/frontend typechecks and health/API tests pass.
- [x] Isolated PostgreSQL integration tests pass.
- [x] Running development API smoke test records, retrieves and completes a session.
- [x] Physical iPhone loads the library, program schedule and template detail.
- [x] iPhone shows API failure and recovers after restart/refresh.

Acceptance is recorded in MEMORY.md. Phase 2 is not a public-release gate: authentication, authorization, HTTPS and dependency-audit review remain required before public access. Existing frontend vulnerability reports have not been resolved by this phase.
