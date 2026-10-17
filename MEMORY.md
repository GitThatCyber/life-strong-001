# Life Strong project memory

Reviewed October 16, 2026. Source: `Life_Strong_Project_Scope_of_Work.docx`, baseline 1.1 amended October 16, 2026. Treat that document as the scope authority; this file is a development handoff summary.

## Product and MVP

Life Strong is a general-purpose fitness and conditioning app for strength, endurance, mobility, and custom programs. Initial seed content is a 12-week mountain biking off-season program; the model must not be specific to that sport.

MVP includes a seeded and custom exercise library; reusable editable workout templates; flexible programs and recurring/week-based schedules; starting, pausing, editing, and completing sessions; logging sets, reps, load, duration, distance, and rest; rest timers; session and exercise history; frequency and personal records; local iOS reminders; units and rest preferences.

Core screens: Home, Programs, Workout, Progress, Settings. Optimize the iPhone workflow for quick workout selection, low-friction logging, and session completion.

Excluded from MVP: social features, leaderboards, AI coaching, nutrition, billing, Apple Watch, HealthKit, Android/web production releases, complex video catalogs, and production-grade offline conflict resolution.

## Approved architecture

- React Native + Expo SDK 57 + TypeScript; Expo Router for navigation.
- Node.js + Express + TypeScript JSON REST API; version endpoints under `/api/v1`.
- PostgreSQL as authoritative storage; `pg`, parameterized SQL, additive SQL migrations, and Zod validation.
- `expo-notifications` for permission-based local reminders/rest alerts. Expo SQLite is planned for local drafts and eventual synchronization.
- Docker Compose for isolated local PostgreSQL; npm and Git; TypeScript and Node test runner/Supertest or Vitest for quality checks.
- Match native/Expo dependencies to SDK 57 compatibility. Preserve any existing validated package manifest and lockfile when integrating code.

API resource groups: exercises, workout-templates, programs, schedule, sessions, progress, preferences, health. Use stable JSON errors, appropriate 4xx/5xx distinctions, and idempotency keys/client operation IDs to support eventual offline retries.

## Data invariants

Entities: users (future authenticated identity), exercises, workout_templates, template_exercises, programs, program_weeks/program_schedule, user_programs, workout_sessions, session_exercises, exercise_sets, reminder_preferences.

Exercise prescriptions and recorded performance are separate. Template/program changes must never rewrite completed sessions. Preserve historical session observations, allowing explicit controlled corrections with audit-relevant timestamps. Store weight canonically in kilograms and convert for display; support measurement-specific exercise values.

## Environment and safety constraints

Target Apple Silicon Mac and iPhone with Expo Go on a trusted local network. Phases 1–2 use a local-only single-user API; do not expose it publicly. Public deployment requires authentication, per-user authorization, HTTPS, secure secrets, least-privilege database access, backups, and hosting decisions.

Keep Life Strong containers, database, volumes, and host port mappings separate from Fill My Cup. Check for existing PostgreSQL port use. Maintain one evolving repository and merge phase packages into it. Preserve local `.env` files; never commit secrets, node_modules, .expo, or build output. Never run destructive Docker volume commands without a verified database backup.

## Delivery gates

1. Foundation: repository, Expo SDK 57 app, Express API, PostgreSQL/Docker, migrations, health checks. Gate: app loads on iPhone, API/DB reachable, backend tests pass.
2. Data/API: exercises, templates, programs, schedules, sessions, sets, seeds, tests, basic iOS browse screen. Gate: migrations/seeds run; APIs behave; session can be recorded, retrieved, and completed.
3. Workout UX: polished set entry, sequence, session editing, rest timer. Gate: complete a session on iPhone without manual API calls.
4. Reminders/offline: local reminders, draft capture and synchronization. Gate: reminders fire and interrupted sessions recover. Full production offline conflict resolution remains excluded.
5. Insights/hardening: history, trends, tests, accessibility, launch readiness. Gate: end-to-end validation and release checklist.

A phase is complete only after its local acceptance checks pass, documentation is updated, and the application can be restored from source and database backups. Document scope changes and use versioned source changes/migrations.

## Verified workspace state and next development step

Initial review found only the scope DOCX. A subsequent directory review on October 16, 2026 found the Phase 1 scaffold: Expo connectivity screen, Express health routes, PostgreSQL Compose configuration, initial metadata migration, tests, documentation, installed dependencies, and backend environment configuration. There is no Git repository or `.gitignore`. Phase 2 feature code is absent. The scope's reported Phase 1 completion still requires database and iPhone acceptance verification.

Backend and frontend TypeScript checks passed. Both existing API tests passed when rerun outside the sandbox (the sandbox blocked local socket binding). Database migrations, database health, and physical iPhone operation were not exercised.

Review findings: frontend `.env.example` and `.env` are missing although README expects them; backend `.env.example` uses port 5432 while Compose exposes 5433. Do not disclose or overwrite the existing backend `.env`. The root package has an unnecessary duplicate `expo-status-bar` dependency (the frontend owns the mobile dependency). Approximately 504 MB of the 505 MB directory is node_modules; excluding these leaves approximately 596 KB. Preserve frontend/backend lockfiles and use reproducible installs; do not manually trim dependency internals. `.DS_Store` files are irrelevant; `.gitkeep` files mark future feature directories and are optional. No cleanup or application changes were made during review.

Recommended next steps: correct environment setup documentation/examples, add ignore rules and initialize source control, remove the root mobile dependency, retain a simple root command runner for the two packages, and verify DB/iPhone acceptance before Phase 2 development. Consolidating to npm workspaces is optional rather than necessary for this small scaffold. Preserve the current Expo manifest/lockfile compatibility baseline.

## Approved cleanup completed October 16, 2026

## Gate 1 accepted October 16, 2026

The user completed the end-to-end test sequence, confirmed the Expo Go app's API connection works, then confirmed the database failure/recovery test succeeded and explicitly cleared work to move on. Gate 1 is accepted. Backend/frontend typechecks and both API tests passed; agent checks confirmed API/database HTTP 200. Migration verification is accepted from the user's completed sequence rather than independently captured output.

Networking resolution: API must remain running in a separate terminal from Expo. Physical iPhone uses `http://10.0.0.85:3000/api/v1` in frontend `.env` (LAN address may change). Firefox successfully reached the API when Safari did not; do not infer router misconfiguration from Safari failure alone. Check Expo Go local-network permission and restart Expo after environment changes. Expo and expo-router were updated via Expo's compatibility workflow to ~57.0.30 and ~57.0.28. Frontend npm audit reported 28 vulnerabilities, requiring separate dependency-path assessment; do not run forced audit fixes.

Next delivery is Phase 2 data and API: additive domain migration, repeatable seed data, validated exercise/template/program/schedule/session/set APIs, preserved session history, API acceptance tests, and a basic iPhone browse screen. Gate 1 acceptance does not establish Phase 2 completion or public-release readiness.

## Cleanup implementation details

The following cleanup notes describe the earlier state; Gate 1 has since been accepted as recorded above.

Initialized Git (no commit created); added `.gitignore` for local environment files, dependencies, caches, build output, Finder metadata, and archives. Retained optional feature-directory placeholders. Removed project `.DS_Store` files outside dependency directories. Removed the duplicate root `expo-status-bar` dependency without changing either package's manifest or lockfile.

Corrected backend `.env.example` to match Docker's host port 5433. Added frontend `.env.example` and created a missing frontend `.env` with a simulator localhost default; physical iPhone development requires the Mac's LAN IP. Existing backend `.env` was preserved. Updated README and the verification checklist to use `npm ci`, preserve existing environment files, and avoid routine dependency mutation.

Added `npm run archive` for compact source handoffs based on Git's tracked/unignored file list; archives include setup examples and omit ignored local environment files and dependencies. Never track secrets; the archive command is not a secret scanner or a database backup. Installed dependencies remain available locally. Both TypeScript checks passed after cleanup; ignore rules and generated archive contents were verified. Existing API tests had passed in the prior review; no application code was changed. DB and physical iPhone acceptance remain pending.

## Phase 2 implementation October 16, 2026

Implemented additive migration `002_training.sql`: exercises, workout_templates/template_exercises, programs/program_schedule, local user_programs activation, workout_sessions/session_exercises/exercise_sets, and seed history. Session exercises snapshot names, measurement types, prescriptions and rest settings. Session/set creation accepts client operation UUIDs with transaction serialization, rejecting conflicting retries. Explicit set corrections preserve IDs and timestamps; completed sessions cannot reopen.

Added Zod-validated `/api/v1` CRUD/archive APIs for exercises/templates/programs; activation and dated schedule; session start/read/pause/resume/complete; measurement-specific set creation/correction; session and exercise history. Stable JSON error envelopes distinguish 400/404/409/500. Single-user local-only remains the operating boundary. Session lists cap at 200 and exercise history at 500, with pagination and aggregate metrics deferred.

Added repeatable starter seed (4 exercises, 2 templates, 1 illustrative 12-week program and 24 schedule entries). Seed history prevents later reseeding from changing user edits. Original MTB training prescriptions were not provided; starter content is explicitly illustrative. Added iPhone library browse, program schedule/template detail, refresh/loading/error recovery. Guided mobile set entry remains Phase 3.

New root commands: `db:seed`, `test:integration`, `verify:phase2`. Integration tests use a unique temporary PostgreSQL schema, run real migration/seed commands twice, validate CRUD/errors/transactions/schedules, exercise all metric types, preserve history after edits, test lifecycle/corrections/retries, and execute the live HTTP smoke script. All 8 reported integration test nodes passed. Both TypeScript checks and existing health tests passed; iOS bundle export succeeded in `/private/tmp/life-strong-phase2-export`. No dependency additions or version changes were required.

Application database migration/seeding is deliberately left to the documented user setup sequence, after their backup. No application data was reset by testing. Gate 2 remains pending the real development API smoke run and physical iPhone browse/error-recovery confirmation. The smoke command adds one real development session per run. `backups/` is ignored by Git and source archives. See `docs/phase-2-testing.md` for complete setup/gate checks and `docs/phase-2-api.md` for endpoint bodies. The frontend dependency audit remains unresolved.

## Current status Gate 2 accepted October 16, 2026

The user explicitly confirmed “Gate 2 has been accepted” after receiving the end-to-end Phase 2 verification instructions. Record the development database setup, API smoke workflow, iPhone library/detail browsing and failure/recovery checks as user-accepted; individual device-test logs were not independently captured. This supersedes the earlier pending Gate 2 status. The Phase 2 acceptance checklist, README and next-steps document are updated.

Next is Phase 3 workout UX: start a workout from a template, guided exercise sequencing, measurement-specific set entry, explicit set editing, pause/resume/completion, and a rest timer. Gate 3 requires completing a session end-to-end on the iPhone without manual API calls. Phase 3 implementation has not started. Continue preserving session snapshots, canonical kilograms/meters, and operation UUID retry behavior. The illustrative MTB prescriptions and unresolved dependency audit remain as previously recorded.

## Current status Phase 3 implemented Gate 3 pending

Implemented October 16, 2026 under the user's instruction to proceed. This supersedes the earlier Phase 3 not-started status. New workout and saved-session routes allow starting from a library template, navigating session exercises, logging all four measurement types, correcting sets (including completed sessions), pausing/resuming, confirming completion, and reopening server-saved sessions. Active/paused sessions sort before completed sessions. Inputs label canonical kilograms/meters/seconds; display-unit preferences remain later work.

The API client now supports validated-error messages and JSON writes. The workout screen serializes requests, preserves pending set payloads/operation UUIDs after failure, supports retry or explicit server reload reconciliation, and prevents accidental duplicate taps. Unsaved input prompts before changing exercise, reloading or leaving through the screen's Back button; iOS swipe-back is disabled on this screen to preserve that confirmation. No offline durability is claimed. Unsaved values/timers reset when leaving the screen or restarting the app, while saved sets can be reopened from Saved workouts.

Rest uses an end timestamp and recalculates on foreground return, supports start/+30/skip, freezes/resumes with the workout, and displays/vibrates on foreground completion. Background notifications and persisted drafts/sync remain Phase 4. Added Expo-selected expo-crypto ~57.0.4 with updated frontend manifest/lockfile for native operation UUID generation. No database migration or dependency-family upgrade was needed; frontend audit still reports 28 findings.

Verification: 5 workout/model/API-client tests passed; both TypeScript checks passed; iOS export succeeded at `/private/tmp/life-strong-phase3-export`; existing isolated PostgreSQL acceptance passed (8 reported test nodes). Health API tests also run as regressions. Expo offline compatibility check found installed dependencies up to date using its local compatibility map. Device UI usability, foreground vibration behavior, and failed-save recovery await the user's iPhone walkthrough in `docs/phase-3-testing.md`. Gate 3 must not be marked accepted until that confirmation arrives. New root command `npm run test:workout` uses the backend's existing tsx runner for dependency-free frontend logic tests.

## Current status Gate 3 accepted October 16, 2026

The user confirmed “Gate 3 has been tested with successful results.” Gate 3 is accepted based on that report, superseding earlier pending status. Record the documented iPhone workout, metric entry/corrections, sequencing, pause/resume/rest, failed-save recovery and saved-session checks as user-accepted; individual device logs were not independently captured. Updated the acceptance checklist, README and next-steps handoff. No application code or database changes were required for this acceptance update.

Next is Phase 4: permission-based local reminders and rest alerts, persistent local drafts/recovery, and a durable synchronization queue with operation UUID reuse. Acceptance requires reminders firing and interrupted workouts recovering without duplicate writes. PostgreSQL remains authoritative, and production-grade offline conflict resolution remains outside MVP. Phase 4 implementation has not started.

## Current status Phase 4 implemented Gate 4 pending

Implemented October 16, 2026 under the user's instruction to proceed. This supersedes the earlier not-started status. Added SDK-compatible expo-sqlite ~57.0.4 and expo-notifications ~57.0.23, updated frontend manifest/lockfile and config plugins. Local notifications and SQLite are available in Expo Go for this workflow, but physical iPhone delivery/storage recovery still requires user acceptance. No remote push token or public API exposure is involved.

SQLite stores a versioned JSON aggregate per API endpoint, containing cached session snapshots, unsaved metric fields, exercise selection, edit targets, timer deadline/paused time, durable start IDs, and ordered outbox writes. Storage commits precede UI success or network sends. Existing cached sessions can record multiple sets, corrections and pause/resume/completion offline. Starting a new session requires a connection; ambiguous starts retain their operation ID for recovery. Queues retry on startup, foreground return and every 15 seconds while the app runs. Synchronization is not an OS background service. Keep the exact endpoint URL stable while pending work exists; namespaces prevent cross-database replay.

The engine preserves exact transmitted requests across restarts, processes FIFO, merges acknowledgments without replacing newer local form edits, and retains blocked 4xx/conflict queues. Workout UI exposes sync status, manual retry and server-value review; discarding queued changes requires explicit confirmation and a successful server fetch. Full production-grade offline conflict merging is not included. Do not uninstall/clear Expo Go data with pending work.

Additive migration `003_correction_receipts.sql` adds exercise_sets.revision and durable correction receipts. PUT corrections support a separate operation UUID plus expected revision/timestamp; matching lost-response retries return the original result, conflicting reuse/stale edits return 409. Existing API clients remain compatible after migration. Application migration and backup are left to the user's end-to-end setup sequence; isolated tests did not reset application data.

Reminders screen supports explicit permission requests, selected-weekday/local-time workout reminders, disable controls, opt-in rest alerts, iPhone settings link, and a 10-second test alert. Persisted rest deadlines are reconciled into native schedules; pause/skip/completion cancel pending rest alerts and resume/+30 update deadlines. The app reconciles schedules on launch and foreground, without prompting for permission automatically. Foreground vibration remains independent of scheduled rest-alert preference. Notification schedules/permissions use Expo Go host identity during local testing.

Verification passed: both TypeScript checks; 12 workout/offline/notification-planning/API-client unit tests; existing 2 health tests; PostgreSQL integration suite (8 reported test nodes), now including real offline engine restart, committed correction with deliberately lost response, receipt replay, one set/one correction revision and queued completion. iOS export succeeded at `/private/tmp/life-strong-phase4-export`; Expo offline compatibility check reports dependencies up to date using its local compatibility map. Frontend audit still reports 28 unresolved findings.

Complete end-to-end instructions and Gate 4 checklist are in `docs/phase-4-testing.md`: back up, migrate 003 twice, install from lockfiles, run tests, verify local notifications locked/backgrounded, cancel/resume alerts, recover unsaved forms/timers after force-quit, and reconnect an offline completed workout with no duplicates. Gate 4 remains pending the user's physical-device confirmation. README, next-steps and API correction documentation are updated. Phase 5 insights/accessibility/release hardening follows accepted Gate 4.

## Current status Gate 4 accepted October 16, 2026

The user confirmed “all tests were successful” after the Phase 4 end-to-end instructions. Gate 4 is accepted on that basis, superseding earlier pending status. Record the migration/backup, notification delivery/cancellation, persisted form/timer recovery, offline restart/synchronization, duplicate protection and conflict-feedback checklist as user-accepted; individual device logs were not independently captured. README, next-steps and the Phase 4 acceptance checklist are updated. No application or database changes were needed for this acceptance update.

Gates 1–4 are accepted. Next is Phase 5: session history and trends, frequency/personal records/adherence summaries, accessibility, end-to-end hardening and a release checklist. Phase 5 implementation has not started. Its gate requires end-to-end validation and documented release readiness; local gate acceptance does not authorize public deployment or remove authentication/authorization/HTTPS/secrets/backups requirements. Unresolved frontend dependency findings and illustrative MTB seed prescriptions remain as previously recorded.

## Current status Phase 5 implemented Gate 5 pending

Implemented October 16, 2026 under the user's instruction to proceed. Added `/api/v1/progress` with validated 30/90/365-day windows and IANA timezone, consistent read-only transaction, completed-session/unique-day/set totals, zero-filled Monday weekly bins with partial-week labels, independent all-time exercise/measurement maxima, daily maxima and recent completed sessions. Current-program adherence matches distinct due slots by template/local session-start date and excludes future slots; no denominator means no percentage. Next workout finds an uncompleted today/future slot. Snapshot exercise names/types preserve history, and corrections recalculate records from current stored observations.

New Progress route linked from Home supports windows, accessible frequency bars with textual equivalents, record selection/daily trends, recent-session navigation, active program and next workout. It discloses pending device changes excluded from reports and retains dated snapshots with errors during outages. Program details now support confirmed activation starting on the device's local date. Added heading/selected-state labels and comfortable link targets. Device VoiceOver/large-type usability still needs human acceptance.

Reliability: PostgreSQL idle errors no longer terminate the API; the server closes HTTP and pool on SIGINT/SIGTERM. Added root `npm run check` for typechecks/frontend logic/health tests and `npm run verify:backup -- <dump>` for isolated Docker restoration checks. Restore helper creates a unique database, restores and queries it, and drops only that database. No new migration/dependency or application database mutation was required for Phase 5.

Verification passed: both TypeScript checks; 13 frontend logic tests; 2 health tests; PostgreSQL acceptance (10 reported test nodes), including empty progress, invalid query validation, exclusion of active/paused sessions, timezone boundaries, correction-aware records, distinct slot adherence and recovery after terminating a test-owned idle connection. iOS export passed at `/private/tmp/life-strong-phase5-export`. A backup of the working Docker database was restored into a unique temporary database and queried successfully, then that temporary database was removed; the working database remained unchanged. The verification dump is under `/private/tmp/life-strong-phase5-verified.dump`, not committed source.

Read-only npm audits: backend zero reported findings; frontend 28 affected package entries (18 high, 10 moderate), exposing four underlying advisory records via decode-uri-component, node-forge, uuid and braces. Installed dependency paths and primary advisory links are documented in `docs/dependency-audit.md`. No forced fixes, SDK family changes or overrides were applied; npm suggestions included incompatible versions. Public-release remediation/review remains outstanding, not implicitly waived by local gate acceptance.

End-to-end instructions are in `docs/phase-5-testing.md`; `docs/release-checklist.md` separates completed local evidence, pending device checks and public blockers. Gate 5 is pending user confirmation of progress, activation/adherence, VoiceOver/large text, outages, offline sync, reminder and draft regressions. Public release also requires authentication/authorization/HTTPS/secrets/hosting, audit disposition, standalone build checks, versioned source baseline, privacy lifecycle and review of remaining unit/settings/program-authoring UI gaps and illustrative seed content. No deployment or App Store action has been performed.

## Current status Gates 1 through 5 accepted October 16 2026

The user confirmed “Acceptance testing for Phase 5 completed” after the end-to-end Gate 5 instructions. Gate 5 is accepted for trusted local single-user use, superseding all earlier pending Gate 5 status. The Phase 5 checklist's device analytics, activation/adherence, corrections, offline/reconnect, VoiceOver/large text and reminder/draft regressions are recorded as user-accepted based on that report; individual device logs were not independently captured. Updated README, next-steps, Phase 5 testing and local acceptance entries in the release checklist. No application code or database changes were made for this acceptance update.

All five delivery gates are accepted. Public release is still blocked by the unchanged release checklist: authentication/per-user ownership/authorization, HTTPS/secrets/hosting, dependency disposition, standalone build/signing/permissions, privacy lifecycle, remaining product scope, release baseline and operational recovery readiness. Existing frontend audit findings and illustrative training content remain as previously documented. Acceptance did not authorize deployment or additional implementation.


## Private release preparation October 16, 2026

The user authorized release work and selected native iPhone use for one private owner, minimizing cost. They own vineandvolt.com and need to create AWS and Apple Developer accounts. Proposed API hostname: lifestrong-api.vineandvolt.com; proposed bundle identifier: com.vineandvolt.lifestrong. Neither is registered/configured here. Recommend private ad hoc installation and a 2 GB Linux Lightsail VM ($12/month published VM baseline, plus backups/domain/tax); Apple membership is $99/year. Actual plan/region and billable provisioning require concrete review. No cloud resource, DNS record, signing certificate or external submission has been created.

Accepted local MVP baseline committed as 30ad053. Release preparation implements migration 004 singleton ownership, scrypt password hashing, rate-limited login, expiring hashed opaque sessions, revocation, production HTTPS/config guards, SecureStore credentials, Bearer API access, retained offline queues on authentication expiry, export and guarded logout/deletion. This supports one owner only; future multi-user access requires a new isolation design. Local .env files and working database have not been changed or migrated by this release preparation.

Prepared compiled non-root container, separate PostgreSQL 17 deployment, restricted runtime database role, Caddy TLS proxy, sanitized operational logging/timeouts, private S3 backup script and native signing configuration. Isolated integration tests cover authentication/export/deletion/revocation; hardened release-image tests pass including runtime privileges and HTTP login rejection. Both typechecks, 16 frontend tests and iOS JavaScript bundle export pass. A JavaScript export is not signing or standalone-device acceptance. Frontend's 28 dependency findings remain unresolved.

Continue with docs/private-release-runbook.md and docs/release-checklist.md. Physical owner-mode tests, real accounts/DNS/TLS, scheduled off-device backup/restore monitoring, dependency disposition, actual ad hoc signing and standalone acceptance remain required. Do not deploy the unauthenticated local MVP or restore/delete working data for destructive tests. Existing pending queues must synchronize before changing endpoints. Privacy and remaining product gaps are explicit gates, not assumed accepted by local Gate 5.


## Phase 6 implemented Gate 6 pending October 16 2026

The user approved adding native customization before pushing and instructed amending the project scope and developing it. Updated Life_Strong_Project_Scope_of_Work.docx to version 1.1, added Phase 6 to its delivery table and section 15 with scope/data rules/Gate 6, updated old local gate status and visually checked all four rendered pages. This supersedes earlier API-only library authoring limitations. Gates 1–5 remain accepted; Gate 6 is not yet user-accepted. No push or cloud deployment occurred.

Migration 005_training_customization.sql adds nullable structured targets (sets/reps/kg/seconds/meters) to template entries and session snapshots, library revisions and exact-request save receipts. Existing prose prescriptions remain intact without inferred targets. Exercise types remain reps, weight_reps, duration and distance_duration. Template targets are validated against exercise type; changing an exercise type is blocked while linked active-library workouts contain incompatible targets. Session start snapshots targets, type, name/order and rest; future template/exercise changes cannot rewrite active/completed sessions. Actual results remain explicitly logged rather than generated from targets.

Native Training library now links to exercise/workout/program creation and editing. Editors support names/equipment/muscle focus/type, workout add/remove/reorder with applicable targets/rest/instructions, and program weeks/week-day assignments. Archive confirmations preserve history and block archiving exercises/workouts referenced by unarchived plans. Archiving an active program deactivates it. Program schedule edits affect current adherence as before. Units remain canonical kg/meters/seconds; display-unit preferences remain an open release product gate. No new dependency was added; navigation uses Expo Router's existing bundled navigation hook.

Editors require a connection. An uncertain save locks editing and retries the identical operation UUID/payload; backend receipts avoid duplicate creates/updates. UI updates include expected_revision and reject stale writes; legacy API writes may omit metadata for backward compatibility. Failed requests retain the mounted form, with leave confirmation. Library drafts are not durable after app close/authentication reset; durable offline library authoring is excluded. Existing workout queue durability is preserved. New APIs support existing routes and empty 204 archive responses. Account deletion clears library save receipts; export includes new target fields but excludes internal receipts.

Verification: both typechecks, frontend tests (19 after archive regression), three health/config tests, isolated PostgreSQL suite (12 reported test nodes), hardened runtime container/least-privilege owner-mode target creation/retry/session snapshot/deletion tests and iOS JavaScript bundle export. Working .env files and application database were not changed/migrated; only isolated fixtures were mutated. Phone keyboard/navigation/accessibility, exact native behavior and owner acceptance remain pending via docs/phase-6-testing.md. Back up/verify, apply migrations twice, restart API/Expo and complete that guide before declaring Gate 6 accepted. Release dependency disposition, accounts/TLS/backups/signing gates remain open. Rollback must preserve Phase 6 targets; older library-writing code can discard targets and is not a safe unrestricted authoring rollback.
