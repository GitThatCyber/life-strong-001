# Life Strong release readiness

Phase 5 is a local single-user acceptance gate. No public deployment, App Store submission, multi-user rollout or authentication is implemented or authorized by this checklist. Gates 1–5 are user-accepted for trusted local single-user use as of October 16, 2026. Public-release blockers below remain open.

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

## Public release blockers

- [ ] Implement authenticated users and per-user authorization for every API resource; migrate local records to an explicit owner and test cross-user isolation.
- [ ] Choose hosting and configure HTTPS, secure credential/session storage, secrets management and least-privilege database roles; remove development credentials from deployment configuration.
- [ ] Resolve frontend dependency advisories or document a reviewed risk disposition; verify a supported SDK/native dependency set as a whole.
- [ ] Verify standalone build signing, final bundle identifier, entitlements, native permissions and notifications outside Expo Go. The current bundle identifier remains an example identifier.
- [ ] Define privacy policy, retention/deletion/export controls, and account/data lifecycle behavior. Do not clear a device cache while unsynchronized writes remain.
- [ ] Confirm remaining product scope, including preferred display units, settings/privacy controls, and UI authoring of programs/templates beyond the current API-based authoring and mobile browsing/activation.
- [ ] Replace illustrative MTB seed content with approved prescriptions, or explicitly ship the starter as illustrative content.
- [ ] Confirm production monitoring, sanitized operational logs, rate limits, timeouts, abuse controls and database recovery procedures.
- [ ] Retain encrypted/off-device backups, scheduled backup monitoring, and periodic restoration drills for the deployed environment. A local Docker dump is not a complete production backup policy.
- [ ] Create/review a versioned release commit/tag and reproducible build artifact. This repository was initialized but currently has no committed baseline.
- [ ] Define release rollback and migration compatibility, including device queue/version compatibility; do not attempt destructive volume resets as rollback.
- [ ] Obtain explicit deployment approval for the concrete target after all applicable blockers are resolved.

## Restoration procedure

From the project root, create a PostgreSQL custom-format backup and verify it with `npm run verify:backup -- backups/your-file.dump`. The verifier creates a unique temporary database in the Docker PostgreSQL service, restores into it, queries migrations/exercises/session counts and removes only that temporary database. It never restores over the working database. The database role must be allowed to create databases.

Use `npm run archive` to package source, manifests, lockfiles and safe environment examples. Local .env files, dependencies, backups and Git history are excluded. Retain secrets separately through an approved secure mechanism. Install dependencies with npm ci in backend/frontend, configure the intended environment, and use the migration runner. Do not replay old device queues against a restored or different database without reviewing their state and endpoint identity.
