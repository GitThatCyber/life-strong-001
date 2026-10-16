# Phase 1 verification

## Gate status

Gate 1 accepted October 16, 2026, following the user's successful end-to-end tests and explicit clearance to move on. Backend/frontend TypeScript checks and both API tests passed. The API and database health endpoints returned HTTP 200 during agent verification. The user confirmed the iPhone app's API connection and the database failure/recovery test succeeded. Migration verification is accepted as part of the user's completed test sequence; its terminal output was not independently captured here.

The tests below remain the repeatable regression procedure. Checkbox state is intentionally separate from the recorded acceptance evidence above.

## Regression procedure

- [ ] Copy both `.env.example` files to `.env` and change mobile API IP.
- [ ] Start Postgres; verify `docker compose ps` indicates healthy.
- [ ] Run `npm ci` in backend and frontend.
- [ ] Run `npm run migrate` twice from backend; second pass skips initial migration.
- [ ] Run backend `npm test` and `npm run typecheck`.
- [ ] Curl `/api/v1/health` → 200, `status: ok`.
- [ ] Curl `/api/v1/health/db` → 200, `database: connected`.
- [ ] Run frontend `npm run doctor`, `npm run typecheck`, and `npm start`. Resolve confirmed compatibility issues before changing the validated manifest or lockfile.
- [ ] Load app in Expo Go or simulator; tap **Test API Connection** → success.
- [ ] Stop database; `/api/v1/health/db` should return 503 (then restart database).

If the physical iPhone cannot connect: verify devices share Wi-Fi, LAN IP is correct, local firewall permits the Node process, and the mobile runtime allows development HTTP. Production endpoints must use HTTPS.
