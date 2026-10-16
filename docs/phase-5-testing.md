# Phase 5 setup and acceptance

Phase 5 adds completed-session summaries, weekly frequency, independent all-time exercise maxima, daily trends, current-program adherence, mobile activation, accessibility improvements, database-connection recovery handling, and release documentation. No new database migration or dependency addition is needed beyond accepted Phase 4.

Gate 5 was accepted October 16, 2026, following the user's confirmation that Phase 5 acceptance testing was completed. Public deployment is separately blocked by the items in release-checklist.md, including unresolved frontend dependency findings and missing authentication/HTTPS/per-user ownership.

## 1 Preserve and verify the baseline

On iPhone, synchronize all pending changes before switching endpoints or upgrading. Keep both local .env files and existing device data. Stop the API with Control+C. Open Docker Desktop and run in Terminal A:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
docker compose up -d postgres
mkdir -p backups
docker compose exec -T postgres pg_dump -U lifestrong -d lifestrong -Fc > backups/before-phase-5.dump
npm run verify:backup -- backups/before-phase-5.dump
```

Expected: restored migration/exercise/session queries and PASS. The verifier restores only to its own temporary database, then removes it; your working database remains unchanged. Stop if the backup/restore check fails. Use a fresh filename if retaining an older backup from an earlier attempt. This command targets Docker; if your actual API uses native PostgreSQL, back up and verify that actual instance separately.

## 2 Install and run checks

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm run db:migrate
npm run db:migrate
npm run check
npm run test:integration
EXPO_OFFLINE=1 CI=1 npm --prefix frontend run doctor
```

Expected: migrations through 003 skip if already applied; both typechecks, 13 frontend logic tests, two health tests, and the PostgreSQL acceptance suite pass. Doctor checks the pinned local SDK compatibility map in offline mode; it is not an online security audit.

The PostgreSQL tests use an isolated schema and verify empty history, invalid windows/timezones, completed-only counts, weekly totals, nonduplicated schedule adherence, correction-aware records, timezone boundaries and reconnection after terminating a test-owned idle connection, alongside earlier workout/offline tests. No application records are reset.

Review docs/dependency-audit.md. Current assessed results are backend zero findings and frontend 28 (18 high, 10 moderate). Audit checks are separate from npm run check: run npm audit in each package when reviewing current registry findings, and expect a nonzero frontend result while findings remain. Do not run forced audit fixes or change SDK families as part of setup.

## 3 Start API and Expo

In Terminal A:

```bash
npm run dev:api
```

In Terminal B:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
npm run dev:ios -- --clear
```

Open the project in Expo Go on the same private Wi-Fi. Preserve the API URL associated with your device's queued data. Keep the API running while testing online views.

## 4 Inspect progress and activate a program

1. From Home tap Progress and training history. Expect a timezone label, dated snapshot and a 30-day summary.
2. Switch among 30, 90 and 365 days. Expect the displayed snapshot to state its actual range. Zero-data windows show zero totals and an explanatory message rather than a fake percentage.
3. Inspect weekly frequency. Weeks start Monday and include zero counts. Edge weeks are labeled partial; the sum of the weekly counts equals the completed-session total for that report.
4. Tap an exercise record to view its daily maxima in the selected window. The all-time recorded bests remain all-time even when the selected window changes.
5. Open a recent completed workout from Progress. Verify its actual recorded sets and corrections. Return to Progress.
6. From the library open the illustrative program and tap Activate program today, then confirm. This intentionally replaces the previous active program and starts Day 1 today; saved history is unchanged.
7. Return to Progress and refresh. Expect the active program name, current-window adherence, and the next uncompleted today/future scheduled workout. Tap that next-workout card to open its template preview.

## 5 Validate live metrics end to end

1. Synchronize any pending changes and refresh Progress. Note the current 30-day completed-session and recorded-set counts.
2. Start a strength workout, record one or more sets and leave it active. Refresh Progress: the unfinished session must not increase completed-session totals or records.
3. Complete the workout, synchronize until zero pending changes, then refresh Progress. Expect exactly one additional completed session and the corresponding sets. Training days only increase if this is a new workout-start date in your timezone.
4. Reopen the completed session and correct a set. Synchronize and refresh Progress. It must reflect corrected observations; maxima change only when the correction changes the relevant maximum. It must not retain a removed peak as a permanent personal record.
5. If multiple completed sessions match the same scheduled template/date, adherence counts that scheduled slot once. A completed session on another day contributes to training totals but not that original slot's same-day adherence. Automated tests verify these cases without adding fixtures to your application database.

Metric definitions: summaries use completed sessions grouped by their workout start date in the phone's timezone. All-time bests are independent maxima per exercise and snapshotted measurement type, not a combined best set or estimated one-rep maximum. Longer time/distance is a recorded maximum, not a fitness score. Adherence compares the current active schedule with matching template/start dates, includes slots due today and excludes future dates. Schedule edits can change this report because it describes the current schedule, not an immutable historical plan.

## 6 Offline and failure regression

1. Cache an active workout while connected, then stop the API in Terminal A. Keep Wi-Fi and Expo running.
2. Record a set and complete that cached workout offline. Open Progress: it must indicate that local pending changes are excluded. A failed refresh must show a connection error and label any previously displayed snapshot with its original date/window.
3. Reopen the cached workout and confirm local records remain available. Restart the API with npm run dev:api, synchronize, then refresh Progress. Expect the completed session once, with no duplicate sets.
4. With the API running, stop PostgreSQL using docker compose stop postgres. Basic API health must remain available; database-backed views should show an error rather than fabricated zero totals.
5. Restart PostgreSQL with docker compose start postgres, wait for healthy in docker compose ps, and refresh. Expect recovery without restarting Expo. The API now handles idle-pool connection errors without exiting.
6. Verify one locked-screen test notification and one interrupted draft recovery using the Phase 4 controls. Phase 5 must preserve those accepted behaviors.

## 7 Accessibility on the iPhone

1. Turn on VoiceOver in iPhone Accessibility settings. Navigate Home, library, Progress, workout forms and Reminders.
2. Confirm page headings, button/link names, selected date windows/weekdays and input units are understandable. Weekly bars have spoken text equivalents; information must not depend on color alone.
3. Edit a set using VoiceOver. Confirm labels distinguish reps, kg, seconds and meters. Verify Save/Record, pause, completion and confirmation controls can be reached and activated.
4. Increase text size, including Larger Accessibility Sizes. Check small-screen scrolling, wrapped labels, keyboard entry and completion controls for clipping or overlap. Home scrolls instead of hiding its links.
5. Confirm the rest countdown does not announce every tick; status changes and errors should be understandable without trapping focus. Test with sound/haptics disabled as well; text still explains timer state.
6. Restore your preferred accessibility settings after testing. Device usability and focus behavior require human verification; source labels and successful bundling alone do not establish compliance.

## 8 Source recovery and release review

```bash
npm run archive
```

Expect a compact source archive under archives/. It includes code, lockfiles and environment examples and excludes local secrets, dependencies, backups and Git history. Keep the verified database backup separately. Review docs/release-checklist.md, including unresolved product scope and public-release blockers. There is no automatic deployment or App Store submission in this phase.

## Gate 5 checklist

Accepted October 16, 2026, based on the user's acceptance-test completion report in this conversation. The device checks are recorded as user-accepted; individual device-test logs were not independently captured. Retain this procedure for regression testing.

- [x] Backup restored successfully into an isolated database.
- [x] Typechecks, logic, API and PostgreSQL regression checks pass.
- [x] Progress windows, completed-only totals, frequency, records/trends and history links behave as documented.
- [x] Program activation, next workout and same-day schedule adherence work.
- [x] Corrections, pending synchronization, outages and reconnection produce accurate progress.
- [x] VoiceOver, large text and small-screen input/scrolling are usable on iPhone.
- [x] Reminder delivery and interrupted draft recovery still pass.
- [x] Source archive and release/dependency limitations reviewed.
- [x] User explicitly accepts Gate 5 for trusted local use.

Gate 5 local acceptance does not imply public-release approval or resolution of the release checklist's blockers.
