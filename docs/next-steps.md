# Phase 2 implementation and acceptance

Gate 1 was accepted October 16, 2026 after the user's successful iPhone API and database failure/recovery checks. Phase 2 was implemented in this repository, with isolated PostgreSQL/API acceptance tests and a successful iOS bundle export. Gate 2 was accepted by the user on October 16, 2026. Keep `phase-2-testing.md` as the repeatable regression procedure. API documentation is in `phase-2-api.md`.

Implemented scope:

1. Add the exercise, template, program/schedule, session and set schema through additive migrations. Snapshot prescribed exercises into sessions so later template edits cannot change historical performance.
2. Add repeatable exercise/template/program seed data. No detailed 12-week MTB prescription has been supplied; any starter plan must be labeled illustrative rather than represented as the user's original training plan.
3. Implement `/api/v1` resource endpoints with Zod validation, parameterized SQL, stable JSON errors, transactions, and retry-safe operation IDs for workout writes.
4. Test migrations/seeds, CRUD behavior, session creation, set correction, retrieval and completion, and historical independence from template edits.
5. Add a basic iPhone exercise/program browse screen and verify it against the local API.

Phase 2 remains local-only and single-user. Authentication and per-user authorization are mandatory before public access or multi-user use. Reassess the reported frontend audit findings before launch; avoid forced dependency upgrades that break Expo compatibility.

## Delivered Phase 2 features

- Exercise catalog schema and CRUD
- Program / workout template schema, including week/day assignments
- Workout sessions and immutable historical set data
- Request validation (Zod) and data-access repositories
- Seed an illustrative 12-week MTB program structure as data, pending actual training prescriptions

## Phase 3 accepted

Phase 3 now includes template-to-workout navigation, native metric forms, set corrections, exercise navigation, saved-workout continuation/review, pause/resume/completion, and a rest timer. Pending saves retain their operation UUID/payload for retries; unsaved edits prompt before screen/selection changes. See `phase-3-testing.md` for the full device acceptance procedure. Gate 3 was accepted October 16, 2026, after the user confirmed successful testing of the iPhone workflow.

The frontend adds SDK-compatible expo-crypto ~57.0.4 for native UUID generation; no backend schema changes were needed. Saved records remain in PostgreSQL; unsaved drafts and timers do not persist after leaving the screen. Phase 4 adds durable drafts/sync and local/background notifications. Retain session snapshots and canonical metric units. Authentication/account ownership precede any multi-user/public use, and the existing frontend audit findings remain unresolved.

## Phase 4 accepted

Implemented permission-based weekly workout reminders, scheduled rest alerts, persistent SQLite workout forms/timers, and an ordered synchronization queue for cached sessions. Set corrections now have retry receipts and optional timestamp/revision preconditions via migration 003. Offline writes and corrections persist before transmission and replay with their original operation IDs. Conflicts retain the queue for review; no automatic production-grade multi-device merge is claimed. PostgreSQL remains authoritative.

See `phase-4-testing.md` for backup/migration/install steps and iPhone reminder, force-quit recovery and offline/reconnect tests. Gate 4 was accepted October 16, 2026, following the user's confirmation that all tests succeeded. New session start needs a connection; cached sessions support offline recording and completion. Synchronization retries while the app runs/returns to foreground, not as a background OS service. Never clear Expo Go data while queued changes remain.

After Gate 4, Phase 5 adds history/trends, accessibility, comprehensive end-to-end hardening and a release checklist. Authentication/authorization/HTTPS and the unresolved dependency audit precede public release.

## Phase 5 accepted for local use

Implemented timezone-aware completed-session summaries, zero-filled weekly frequency, per-measurement independent all-time records and daily maxima, recent-history links, current-program adherence/next-workout view and program activation from library details. Added heading/selection/accessibility labels, textual chart alternatives, graceful API shutdown and database idle-connection recovery handling. No new dependency or database migration was required.

Typechecks, 13 frontend logic tests, two health tests and the PostgreSQL suite (10 reported test nodes) pass. A development backup was restored and queried in a temporary database, then removed. The working database was unchanged. iOS bundle export passed. Gate 5 was accepted October 16, 2026, after the user confirmed completion of acceptance testing. Retain phase-5-testing.md for regression checks.

The release checklist and dependency-audit.md distinguish trusted local use from public readiness. Backend audit reports zero findings; frontend remains at 28 affected package entries. No forced SDK downgrade/upgrade or transitive override was applied. Public release still requires security/ownership/hosting work, audit disposition, standalone build verification, product-scope review and an explicit deployment decision. Remaining settings/unit/privacy and program-authoring UI gaps are listed rather than assumed complete.

## Post acceptance handoff

All five delivery gates are accepted for trusted local single-user use. Further work should address the explicit product gaps and public-release blockers in release-checklist.md. No deployment, App Store submission, SDK migration or additional implementation was authorized by the acceptance update.


## Private release preparation October 16, 2026

The user authorized release work and selected native iPhone use for one private owner, minimizing cost. They own vineandvolt.com and need to create AWS and Apple Developer accounts. Proposed API hostname: lifestrong-api.vineandvolt.com; proposed bundle identifier: com.vineandvolt.lifestrong. Neither is registered/configured here. Recommend private ad hoc installation and a 2 GB Linux Lightsail VM ($12/month published VM baseline, plus backups/domain/tax); Apple membership is $99/year. Actual plan/region and billable provisioning require concrete review. No cloud resource, DNS record, signing certificate or external submission has been created.

Accepted local MVP baseline committed as 30ad053. Release preparation implements migration 004 singleton ownership, scrypt password hashing, rate-limited login, expiring hashed opaque sessions, revocation, production HTTPS/config guards, SecureStore credentials, Bearer API access, retained offline queues on authentication expiry, export and guarded logout/deletion. This supports one owner only; future multi-user access requires a new isolation design. Local .env files and working database have not been changed or migrated by this release preparation.

Prepared compiled non-root container, separate PostgreSQL 17 deployment, restricted runtime database role, Caddy TLS proxy, sanitized operational logging/timeouts, private S3 backup script and native signing configuration. Isolated integration tests cover authentication/export/deletion/revocation; hardened release-image tests pass including runtime privileges and HTTP login rejection. Both typechecks, 16 frontend tests and iOS JavaScript bundle export pass. A JavaScript export is not signing or standalone-device acceptance. Frontend's 28 dependency findings remain unresolved.

Continue with docs/private-release-runbook.md and docs/release-checklist.md. Physical owner-mode tests, real accounts/DNS/TLS, scheduled off-device backup/restore monitoring, dependency disposition, actual ad hoc signing and standalone acceptance remain required. Do not deploy the unauthenticated local MVP or restore/delete working data for destructive tests. Existing pending queues must synchronize before changing endpoints. Privacy and remaining product gaps are explicit gates, not assumed accepted by local Gate 5.


## Phase 6 customization implemented acceptance pending

The user approved native customization before pushing. The Word scope is now version 1.1 with Phase 6 and its own acceptance gate. Native library editors cover exercise fields/type, workout exercise order and structured sets/reps/load/duration/distance/rest targets, and program length/week-day assignments. API migration 005 adds target snapshots, revision checks and retry receipts. Existing session history remains independent of template edits.

Follow [Phase 6 setup and acceptance](phase-6-testing.md): verify a backup, migrate twice, run checks, restart API/Expo and test on iPhone. The working database and .env files have not been changed by isolated development tests. Gate 6 awaits the user's confirmation. Library authoring needs a connection and does not persist unsaved forms after app close/authentication reset; existing workout offline durability remains. Release signing/hosting/backups/dependency review and display-unit preferences remain open. No push/deployment was performed.
