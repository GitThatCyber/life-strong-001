# Life Strong release readiness

Gates 1–5 are user-accepted for trusted local use. The selected release target is a native iPhone app for one private owner, with minimum ongoing hosting cost. Private ad hoc installation avoids a public App Store listing but requires paid Apple membership. No cloud resources, DNS changes or signing have been performed. See [private release runbook](private-release-runbook.md) and [hosting options](hosting-options.md).

## Private release preparation implemented

- [x] Local accepted-MVP baseline committed as `30ad053`.
- [x] Migration 004 assigns existing records to one private owner; no public signup or multi-user support.
- [x] Owner password hashing, expiring/revocable opaque sessions, login limits and production HTTPS/configuration guards.
- [x] Native Keychain credential storage, authenticated API client, retained offline queue after expired authentication.
- [x] Account export, guarded logout/cache clearing and account deletion; deletion tests use isolated fixtures.
- [x] Compiled non-root API container, restricted PostgreSQL runtime role, internal database/API networking and Caddy TLS configuration.
- [x] Sanitized request logs, request timeouts and prepared off-device backup script.
- [x] Native build configuration rejects HTTP endpoints, example identifiers and disabled owner authentication.
- [x] Automated owner lifecycle/database integration and hardened release-image smoke tests pass; iOS JavaScript export succeeds. This is not a signed native build.

## Evidence completed during Phase 5

- [x] Completed-session analytics, timezone windows, all-time records and daily trends implemented.
- [x] Current-schedule adherence and program activation exposed on iPhone.
- [x] Automated analytics, offline/retry, validation and API/database regression tests pass.
- [x] iOS bundle export succeeds with the pinned SDK 57 dependency family.
- [x] Backup restored into a temporary database and queried successfully; working database unchanged.
- [x] Dependency audits assessed: backend zero findings, frontend 28 package entries unresolved; see dependency-audit.md.
- [x] Accessibility labels, selectable state, readable chart text, heading roles and scrollable Home added/reviewed in source.

## Local acceptance confirmed by user October 16 2026

- [x] Complete Phase 5 iPhone analytics, date-window, correction, pending-sync and outage tests.
- [x] Verify VoiceOver navigation/announcements and large Dynamic Type on the physical device.
- [x] Recheck workout completion, offline recovery and a locked-screen local notification after the update.
- [x] Review limitations and explicitly accept Gate 5 for trusted local use.

## Remaining private release gates

- [ ] Create AWS account with MFA and budget alerts; enroll in Apple Developer Program. User owns vineandvolt.com but has neither account yet.
- [ ] Confirm proposed hostname `lifestrong-api.vineandvolt.com` and available bundle identifier `com.vineandvolt.lifestrong` during account setup.
- [ ] Complete physical iPhone owner-mode acceptance, including preserved offline writes after reauthentication and safe logout/export.
- [ ] Approve concrete region/plan/cost, then deploy real HTTPS/DNS and verify access restrictions. Proposed Lightsail 2 GB public-IPv4 VM baseline is $12/month before extras.
- [ ] Resolve frontend dependency advisories or record reviewed risk disposition; 28 affected package entries remain open. Preserve compatible Expo/native dependencies.
- [ ] Produce signed ad hoc build; verify entitlements, permissions, notifications and standalone operation without Expo Go/Metro.
- [ ] Review privacy inventory, backup retention and data lifecycle; device SQLite is not app-level encrypted. Account export/deletion are implemented but phone acceptance remains pending.
- [ ] Confirm remaining product scope: preferred units, settings and program/template authoring beyond API-based authoring and mobile browsing/activation.
- [ ] Approve illustrative training seed content or replace it with approved prescriptions.
- [ ] Configure real monitoring, private encrypted off-device backups, failure alerts and restoration drills. Prepared scripts are not running infrastructure.
- [ ] Record final release commit/tag, immutable image digest and signed build artifact after acceptance.
- [ ] Verify rollback/migration and device-queue compatibility against the deployed environment.
- [ ] Final rollout approval after applicable gates pass. Public multi-user access requires a separate isolation design and acceptance gate.

## Restoration procedure

From the project root, create a PostgreSQL custom-format backup and verify it with `npm run verify:backup -- backups/your-file.dump`. The verifier creates a unique temporary database in the Docker PostgreSQL service, restores into it, queries migrations/exercises/session counts and removes only that temporary database. It never restores over the working database. The database role must be allowed to create databases.

Use `npm run archive` to package source, manifests, lockfiles and safe environment examples. Local .env files, dependencies, backups and Git history are excluded. Retain secrets separately through an approved secure mechanism. Install dependencies with npm ci in backend/frontend, configure the intended environment, and use the migration runner. Do not replay old device queues against a restored or different database without reviewing their state and endpoint identity.
