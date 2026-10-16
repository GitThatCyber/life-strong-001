# Phase 4 setup and acceptance

Phase 4 adds persistent iPhone workout forms, a durable ordered synchronization queue, local workout reminders, and scheduled rest-completion alerts. Gates 1–3 are accepted. Gate 4 was accepted October 16, 2026, based on the user's confirmation that all tests were successful. The device checks below remain the regression procedure.

PostgreSQL remains authoritative. SQLite stores the device's cached sessions, form state, timers and pending writes. Workouts must start while connected; once the session is cached, its sets, corrections, pause/resume and completion can be recorded offline. New exercise/template/program creation is not an offline feature. Automatic synchronization runs on app startup, on foreground return, and every 15 seconds while the app is running. It is not an iOS background synchronization service.

## 1 Stop the API and back up

Press Control+C in the API terminal. Open Docker Desktop. In Terminal A:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
docker compose up -d postgres
docker compose ps
mkdir -p backups
docker compose exec -T postgres pg_dump -U lifestrong -d lifestrong -Fc > backups/before-phase-4.dump
test -s backups/before-phase-4.dump
docker compose exec -T postgres pg_restore --list < backups/before-phase-4.dump
```

Expect a healthy PostgreSQL service and a valid archive listing. Stop on a backup error. Use a new filename if retaining a backup from an earlier Phase 4 attempt. If backend/.env points to a native PostgreSQL instance rather than Docker, back up that actual instance instead. Do not delete volumes or reset existing application records.

## 2 Install and migrate

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm run db:migrate
npm run db:migrate
```

Expected: `003_correction_receipts.sql` applies once and then skips. This adds a set revision counter and correction receipts for retry-safe edits. Existing workouts/sets remain. No seed rerun is needed if Gate 2's seed exists.

The frontend adds Expo-selected `expo-sqlite` ~57.0.4 and `expo-notifications` ~57.0.23. Preserve the package lockfiles. Local notifications remain available in Expo Go according to the [SDK 57 notification reference](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/). SQLite is also included in Expo Go and persists across app restarts, as documented in the [SDK 57 SQLite reference](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).

## 3 Run automated checks

```bash
npm run check:api
npm run check:ios
npm run test:workout
npm run test:api
npm run test:integration
```

Expected: both typechecks pass, 12 workout/offline/notification-planning tests pass, two health tests pass, and the PostgreSQL/API suite passes. The normal API test command skips the database suite; test:integration runs it explicitly in a unique temporary schema.

The integration suite runs the real offline engine against a live test API, records while disconnected, reconstructs the engine from persisted state, loses a correction response after the API commits it, restarts again and confirms one set, one applied correction revision, and completed status. Unit tests also verify FIFO ordering, preservation of concurrent form edits, disk-write failure behavior, stale-correction blocking, notification planning, and durable start operation IDs. Native notification delivery and native SQLite force-quit recovery still require the device checks below.

## 4 Start API and Expo

In Terminal A:

```bash
npm run dev:api
```

Leave it running. In Terminal B:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
npm run dev:ios -- --clear
```

Open the project in Expo Go. Check that frontend/.env still points to your Mac's current LAN IP on port 3000, and Expo Go has Local Network access. Preserve the exact API URL while local changes are pending: the cache is partitioned by endpoint to avoid sending one database's queue to another database. If you change the URL, the previous queue remains under its previous endpoint namespace; restore the old URL to access it. Do not reinstall Expo Go, clear its application data, or switch backend databases while unsynchronized work remains.

## 5 Enable and test notifications

1. From Home open Reminders and rest alerts.
2. Tap Send a test alert in 10 seconds. Allow notification permission if prompted.
3. Lock the iPhone or switch apps for at least 10 seconds. Expect the Life Strong test notification.
4. Select today's weekday and set the reminder time about two minutes ahead using the 24-hour clock. Tap Save / enable workout reminders, then lock the phone. Expect a workout reminder at that local time. It repeats weekly on each selected day.
5. Disable workout reminders. Re-enable with a new near-future time and disable before that time; confirm no future workout reminder is delivered. The explicit 10-second test notification is independent of the recurring reminder toggle.
6. Enable rest alerts. Open a strength workout, record a set, then lock the phone. Expect Rest complete at its timer deadline.
7. Repeat with Pause workout before the deadline; expect no rest alert while paused. Resume, lock the phone, and expect the rescheduled alert.
8. Repeat with Skip rest and with Complete workout before the deadline; expect the corresponding pending rest alerts to be canceled.
9. Disable rest alerts and repeat a rest timer. Expect no scheduled system rest notification. The on-screen timer and foreground vibration remain available.
10. If permission is denied, recording workouts must still work. Use Open iPhone notification settings to enable notifications for Expo Go, then enable/test alerts again.

Focus modes, Scheduled Summary, device sound/vibration settings and notification permissions affect presentation. Expo Go notifications use Expo Go's host identity; a standalone development/release build needs its own permission and physical-device checks. These are local notifications, not remote push messages; no push token or public API is needed.

## 6 Recover an interrupted form and timer

1. While connected, start a new Starter strength workout. Enter reps and load but do not tap Record set.
2. Return Home, open Saved workouts, and reopen that session. Expect the same exercise, field values and edit state. Form fields are stored on every input change; typing alone does not create a set.
3. Force-close Expo Go using the iPhone app switcher, reopen the same project, then open the session from Saved workouts. Expect the same unsaved fields.
4. Record the set. Expect it to appear exactly once. The status transitions from pending changes to All recorded changes synchronized while connected.
5. Start rest, force-close/reopen, and reopen the workout before the deadline. Expect remaining time based on the original end timestamp. Repeat after the deadline: expect rest complete. With rest alerts enabled, notification delivery is independently handled by iOS after scheduling.
6. Pause and leave/reopen the session. Expect paused state and preserved remaining rest time. Resume to continue.

## 7 Record and complete offline, then synchronize

Use an API outage while keeping Wi-Fi and Expo/Metro available. Airplane mode can prevent Expo Go from reloading a development project after force-quit, obscuring the workout recovery test.

1. Start a fresh workout while the API is available. Leave the workout screen open.
2. Stop only the API with Control+C in Terminal A. Keep PostgreSQL and Expo running.
3. Record two sets on the phone. Expect both sets to appear locally with a nonzero changes-waiting-to-sync count. Continue to another exercise and record another set.
4. Edit a locally queued set. Expect the correction to remain visible. Pause/resume and optionally complete the workout. These actions join the same ordered queue.
5. Force-close/reopen Expo Go while the API remains stopped. Open the cached workout from Saved workouts. Expect the queued sets, corrections, form and status to remain. An offline message is expected; the data must remain available.
6. Restart the API with `npm run dev:api`.
7. Keep the app open and tap Sync / refresh now, or wait for its foreground retry. Expect pending changes to reach zero and All recorded changes synchronized.
8. Reopen the workout and tap Sync / refresh now once more to fetch server records. Expect identical values, one record per set, and the correct completed/paused/active status. Repeat refresh; no duplicate sets may appear.
9. Complete the workout if not already completed, synchronize, and review it from Saved workouts. No manual API calls should be required for this sequence.

## 8 Conflicts and recovery controls

A stale correction or another 4xx response blocks that workout's queue. The app preserves all local changes, displays the server error, and stops automatic retries for that queue. Other workouts can still synchronize.

Review server records fetches and displays the server's exercise/set values without discarding local data. Keep local queue retains the pending work. Discard local queue requires a second explicit confirmation and fetches server records before replacing queued data; use it only when intentionally abandoning those unsynchronized edits. Retry preserves the exact original request and does not force an overwrite of a stale version. There is no automatic production-grade multi-device conflict merge in this phase. Automated tests exercise stale revision rejection and correction receipt replay.

## Gate 4 acceptance checklist

Accepted October 16, 2026, based on explicit user confirmation of successful tests. Device results are user-reported; individual device-test logs were not independently captured.

- [x] Backup verified; migration 003 applies once and skips on repeat.
- [x] Typechecks and all automated workout/API/database tests pass.
- [x] Local test alert and selected-weekday workout reminder arrive on iPhone.
- [x] Disabling reminders/rest alerts cancels future scheduled alerts.
- [x] Rest alert arrives while locked; pause/resume/skip/completion update it correctly.
- [x] Unsaved form, exercise selection, paused status and timer recover after leaving and force-closing.
- [x] Multiple offline sets, a correction and session completion survive app restart.
- [x] Reconnection synchronizes with zero duplicates and correct server values.
- [x] Conflict feedback preserves local records and requires explicit discard confirmation.

Gate 4 acceptance is recorded in MEMORY.md. The current implementation is local single-user development, not public/multi-user release readiness. Existing frontend audit findings remain unresolved.
