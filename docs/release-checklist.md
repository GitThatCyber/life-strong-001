# Life Strong release readiness

Updated October 17, 2026. Gates 1–6 are user-accepted for the existing Expo/Express/PostgreSQL app. The owner approved migration to SwiftUI + local SwiftData + private CloudKit and deferred AWS. Phase 7A development/local automated verification is implemented; native owner-device/live CloudKit acceptance and later migration gates remain pending. This checklist supersedes the earlier server-deployment release direction.

## Accepted legacy baseline

- [x] Gates 1–5: API, training data, workout UX, durable offline queues/reminders and progress/accessibility accepted October 16, 2026.
- [x] Gate 6: exercise/workout/program customization and follow-up consecutive exercise creation accepted October 17, 2026.
- [x] Legacy automated typechecks, frontend/API/database tests and container checks passed during development; iOS JavaScript bundle export passed. These are not native Swift build results.
- [x] Isolated backup restoration verified during previous work. A fresh cutover backup will still be required.
- [x] Existing owner auth, token storage, export/deletion and deployment safeguards retained while legacy code is used.
- [x] AWS/Apple account creation reported by owner; actual services, MFA and paid Apple membership are not independently verified.
- [x] AWS integration deferred; target architecture and Phase 7 migration plan documented.

## Phase 7 native migration gates

- [x] 7A development: SwiftUI Xcode project, versioned SwiftData schema/local repository, fixture workout flow and recovery/export implemented in ios-native/.
- [x] Three native core XCTest cases, two simulator UI workflows, local build and unsigned CloudKit iPhoneOS compilation pass.
- [ ] Accept 7A: owner physical local/offline checks plus signed private-development schema/sync evidence in phase-7a-testing.md. An unsigned build is not cloud acceptance.
- [ ] Verify actual iPhone OS/minimum deployment target and supported Xcode toolchain. Proposed iOS minimum 17 must be validated.
- [ ] Owner confirms Apple team, paid program enrollment, rehearsal/final bundle IDs, private container IDs and required signing/capabilities.
- [ ] 7B: implement repeatable-read credential-free SQL export, separate Expo device recovery export and staged native import under data-migration-contract.md.
- [ ] Verify counts/UUIDs/targets/snapshots/actuals/correction audit/archives/date semantics and analytics parity. Repeat/interrupted/bad imports must not duplicate or lose data.
- [ ] 7C: implement native library/program/workout/progress/settings/reminder screens with all accepted feature behavior; local saves and new sessions work offline without API/Metro/Mac.
- [ ] Recheck durable forms/timers, explicit corrections, consecutive exercise creation, archive safeguards, VoiceOver, Dynamic Type and physical notification delivery.
- [ ] 7D: prove private same-account sync, partial hydration states, deduplication/conflict handling, account-switch isolation and network/quota recovery. Single designated authoring device initially; do not imply unrestricted multi-writer guarantees.
- [ ] Verify local-only drafts/preferences/notification schedules do not cause duplicate cross-device alerts.
- [ ] Verify export/import recovery, local cache removal versus cloud data deletion, and retained backup lifecycle. Cloud sync alone is not backup proof.
- [ ] Review/deploy the intended production CloudKit schema through the owner's account; schema deployment does not transfer development records.
- [ ] 7E: synchronize/reconcile legacy queues and ambiguous starts, freeze legacy writes, create final verified backups/exports, import once into the intended production destination and compare results.
- [ ] Owner accepts signed standalone native app and cloud/recovery behavior on iPhone; record source/build/schema/container/import evidence before retiring legacy services.

## Remaining product and release decisions

- [ ] Confirm preferred display units and remaining settings scope; preserve canonical kg/meters/seconds in migration.
- [ ] Approve illustrative training content or replace it with approved prescriptions; do not overwrite custom data by seeding.
- [ ] Review actual native dependencies/privacy/permissions/signing. Existing 28 frontend dependency findings remain a legacy concern while that tree is still in use; they are not declared fixed by the new architecture.
- [ ] Agree on private-data export retention and recovery process; verify real restore rather than an upload indication.
- [ ] Record final versioned source, reproducible signed build and user acceptance. Public distribution/multi-user scope remains separate.
- [ ] Retirement review after native acceptance: retain legacy rollback evidence and reconcile any new native writes before returning to an older PostgreSQL snapshot.

## Deferred server deployment

Lightsail/S3/DNS/host monitoring, HTTPS API deployment and server owner-login phone acceptance are no longer gates for the SwiftData target. Historical deployment files remain intact for recovery/reference. No AWS account action, purchase, DNS change, cloud deletion or Apple schema action was executed by Codex. If resources exist independently, the owner reviews them separately; deferral does not stop billing.

## Preservation during migration

Keep the working PostgreSQL volume, .env files, source/lockfiles and Expo device storage. Use the existing verify:backup helper to restore a legacy dump only into its unique temporary database. Never clear pending queues, reset real CloudKit environments or overwrite a populated store to retry migration. After native writes begin, the old database is stale; reverse conversion is not assumed available.

Primary procedures: [migration plan](swiftdata-migration-plan.md), [data contract](data-migration-contract.md), [architecture](architecture.md). All native acceptance boxes remain open until implemented and verified.
