# Life Strong native SwiftData migration plan

Approved architecture change October 17, 2026. Replace the current Expo/Express/PostgreSQL runtime with SwiftUI, local SwiftData and private CloudKit. AWS integration is deferred. Phase 7A development is now implemented alongside the accepted app; physical-device/live CloudKit acceptance remains pending. The foundation has a diagnostic native export, not the legacy migration exporter/importer. Gates 7B–7E and live CloudKit setup are not completed. See [Phase 7A testing](phase-7a-testing.md).

Gates 1–6 remain accepted as the legacy behavior baseline. Native acceptance starts a new Phase 7 and must repeat the relevant user workflows. Keep the functioning legacy app/data throughout migration.

## Decisions and scope

- Build in a new ios-native/ directory within this repository. Retain frontend/, backend/, database/ and deployment/ until data recovery and native acceptance pass. Existing uncommitted exercise-creation and documentation changes must be preserved.
- Native screens use SwiftUI; SwiftData replaces network/API persistence, not just the PostgreSQL driver. Express routes become Swift domain/repository methods. No app-owned API server or owner password login in the final target.
- Target the owner's iPhone first. SwiftData requires iOS 17 or later; proposed minimum iOS 17 remains subject to the actual device and required framework behavior. Validate deployment target/toolchain during the first spike.
- Use the owner's private CloudKit database for training data. Keep drafts, timers, permissions and local reminder schedules in a separate device-local store/settings. Require explicit local saves so every confirmed action survives termination without a network.
- One designated phone performs import and initial workout authoring. Test sequential sync with a second device, but unrestricted simultaneous multi-device editing remains outside this personal-app migration. Do not promise SQL-style distributed revision locks.
- Preserve all accepted library/workout/progress/reminder behavior, including consecutive exercise creation. Display-unit preferences and other previously open product gaps remain open unless separately implemented; the rewrite is not permission to drop features or silently add new scope.
- No AWS spend is required for the target runtime. Private CloudKit uses the user's iCloud allowance; membership/signing, any additional iCloud plan and optional domain renewal remain separate. Plenty of storage does not imply instantaneous or unlimited sync.

## Work packages and gates

| Package | Deliverable | Exit evidence |
| --- | --- | --- |
| 7A Native foundation and schema spike | Xcode SwiftUI project, versioned SwiftData schema, local store and private-development-container feasibility | Local create/save/relaunch; model validation with real CloudKit-capable signing; constraints verified before expanding screens |
| 7B Export and import rehearsal | Read-only SQL snapshot exporter, legacy device recovery export, versioned native importer and comparison report | Full graph/metrics/archives preserved; failed/repeated/interrupted import safe; no real-data mutation |
| 7C Native feature parity | Library/program editors, workout logging/corrections, timers/reminders, history/progress, export/settings | All six legacy workflows repeated on native iPhone entirely without API/Mac; airplane-mode creation and recovery |
| 7D Private sync and recovery | CloudKit setup, account-state handling, duplicate/conflict protection, export/restore | Same-account second-device convergence; missing network/account/quota/partial download handled; recoverable backup restoration |
| 7E Cutover and retirement | Verified final import, signed standalone install, acceptance report and rollback archive | Owner accepts native release, data counts/fingerprints and sync pass, source/build tagged; retire legacy only afterward |

7A/7B may use isolated fixtures in parallel conceptually, but real import is strictly sequenced. No calendar dates or duration estimates are assumed. Complete each package's evidence before claiming its gate.

## Proposed native project structure

```text
ios-native/
  LifeStrong.xcodeproj
  LifeStrong/
    App/                     app entry and explicit container setup
    Persistence/             VersionedSchema and SchemaMigrationPlan
    Models/                  training entities and snapshot models
    Domain/                  validation training commands progress calculations
    Features/                home library workout sessions reminders progress settings
    Migration/               versioned DTOs import staging and verification reports
    Services/                notifications export and account/sync diagnostics
  LifeStrongTests/           fixtures domain/import/schema regression tests
  LifeStrongUITests/         core workflows accessibility and recovery
```

This is the target layout for the complete migration. The 7A project exists now; its initial models/domain/persistence/export are grouped in LifeStrong/Core, with App and Features alongside it. Remaining feature/migration/service folders are added in later packages. Use the installed Xcode with an Apple-supported SDK and verify the owner's deployment target. Configure a separate rehearsal bundle/container before final identifiers. Proposed final bundle com.vineandvolt.lifestrong and private container iCloud.com.vineandvolt.lifestrong require availability/team validation; do not overwrite an installed app merely to reuse an identifier.

## Schema and API replacement

Use the entity/field mapping in [data migration contract](data-migration-contract.md). Keep stable domain UUIDs separate from SwiftData persistent identifiers. Store string-backed measurement/status values with validation; numeric fields remain canonical kg/m/seconds. Prefer explicit optional inverse relationships with default/optional CloudKit-compatible attributes and explicit ordering fields. Validate relationships as domain rules while tolerating temporary partial graphs during sync.

Do not use @Attribute(.unique) or assume SQL foreign-key/unique enforcement in CloudKit. Never port an SQL cascade as unchecked deletion of exercise history. Archive library items; preserve independent session snapshots. Use VersionedSchema and SchemaMigrationPlan from v1, with a migration fixture test before changes. Production CloudKit schemas evolve additively; rehearsal schema resets are never a production recovery method.

| Existing API responsibility | Native replacement |
| --- | --- |
| Exercise/template/program CRUD, archive and schedule | Validated repository commands saved to ModelContext; archive/reference rules and explicit order |
| Start session | Offline-capable snapshot transaction of template, types, targets, names and rest |
| Record/correct sets and pause/complete | Durable local commands and correction audit; preserve operation IDs for migration/retry; completed status remains terminal |
| /progress reports | Swift calculations over saved sessions, using the same timezone/window/week/adherence definitions and golden fixtures |
| Owner auth/export/delete | Device/iCloud identity boundary, native export/restore and clearly distinct local-removal versus cloud-deletion controls |
| HTTP queue/retries and request receipts | Retire transport outbox after reconciliation; local commits and framework-managed CloudKit delivery; retain necessary audit/provenance |

Persist form/timer changes promptly and explicitly save before acknowledging recorded sets. Use actor/context isolation to serialize commands and imports. Avoid relying on unspecified autosave timing. Prefer small durable commands; errors must leave editable values and existing records recoverable.

For corrections, implement append-only version observations with predecessor IDs so divergent edits can be detected and retained for review. Import current set values as a migration baseline and preserve available legacy receipts without inventing absent earlier values. Do not assume server integer revisions prevent cross-device conflicts. Rehearse divergent offline corrections before committing to the final model. If reliable conflict detection/preservation is not achievable with the chosen managed-sync model, keep secondary authoring disabled and report the limitation; do not claim conflict-proof sync.

## SwiftUI feature parity inventory

1. Home links, program/current next workout, saved-session continuation.
2. Exercise creation/editing with equipment/muscle focus and four measurement types; save-create-next workflow; archive safeguards.
3. Workout builder with repeated exercises, add/remove/reorder, prose instructions and optional sets/reps/load/duration/distance/rest targets.
4. Program weeks/week-day assignments and activation; active schedule edits retain the existing adherence semantics.
5. Session snapshot preview, guided navigation, measurement-specific actual set entry, explicit correction, pause/resume/completion and saved history.
6. Durable unsaved form, selected exercise and timer recovery; starting and authoring now work offline once the native library is local.
7. Permission-based weekly reminders/rest alerts with cancel/reschedule, lock-screen delivery and deadline recovery using UserNotifications.
8. Progress windows 30/90/365 days, local-date grouping, Monday bins, independent all-time maxima, trends, recent sessions, current adherence and next workout; no fabricated zeros during initial CloudKit hydration.
9. Settings/export/restore, private data lifecycle and account/sync status; VoiceOver, large text, keyboard scrolling and understandable errors throughout.

SwiftUI replaces React Native components; TypeScript tests become specifications/fixtures, not automatically reusable native tests. React Native dependency findings stay relevant to the legacy app while it remains in use. Audit the actual native dependency set separately; removing a future runtime dependency does not fix the still-working legacy tree.

## CloudKit setup and runtime behavior

The owner performs account/container/signing actions. Do not log in, create containers or publish schemas without explicit account-operation instructions. Verify active paid Developer membership, compatible entitlements, iCloud/CloudKit capability and required background remote-notification support. Use explicit private database/container configuration, not a public CloudKit database.

Use Apple-managed SwiftData sync initially, not a second hand-written HTTP or CloudKit outbox. Distinguish local saved state from unverified cloud delivery. Automatic background delivery is best effort; do not show “fully synced” solely because ModelContext.save returned. In the feasibility spike, determine which framework events are actually observable and expose only supported diagnostics. Restore/import must not launch automatically just because an initially empty device is still downloading.

Account sign-out/switch is a data boundary. Design a verified account binding and isolated store lifecycle before enabling real sync. On a detected switch, pause cloud writes, quarantine the former account's local store, and require returning to the original account or explicit protected local recovery. Never upload the prior account's data into a new private database; never delete the only offline copy automatically. Test iCloud disabled, temporarily unavailable and no-network separately from an actual account change. Offline access for an established account must remain useful.

Handle quota/permission/service failures without deleting local data. Secondary devices may receive related records out of order; loading/partial states must be explicit and writes requiring missing parents disabled. Use app-level UUID deduplication and one import authority; managed sync does not provide a global unique constraint. Test archive/delete/correction propagation as well as creation. Newest-wins by device clock is insufficient proof that training observations survive conflicts.

Development and production CloudKit are separate environments. Validate using development fixtures, then deploy the reviewed schema to production before the signed distribution test. Development records do not migrate automatically when a schema is deployed. Perform the real personal-data import once into the intended production environment, preserving its manifest and recovery copy.

## Cutover sequence

1. Preserve the accepted source, private .env files and a restore-verified PostgreSQL dump. Keep device storage/Expo installed.
2. Build and pass 7A with disposable local fixtures and a separate development identity/container.
3. Build 7B tools. Rehearse export/import using a copied database, including archives, repeated exercises, optional targets, all measurements, corrections and active/completed sessions. Prove reimport/no duplication and analytics equivalence.
4. Complete 7C and 7D acceptance before touching the owner's actual dataset. Rehearse account-switch and cloud-failure cases only with disposable test data.
5. Choose a short final write freeze. Synchronize all legacy queues and ambiguous starts against their original endpoint. Block cutover on unresolved operations. Capture final consistent SQL export and explicit device recovery file, plus a new verified dump.
6. Preview and import once on the designated phone into the intended native production store. Verify counts, normalized fingerprints, timestamps, prescriptions/targets, actuals, archive flags, active program and progress reports. Keep legacy notifications until native delivery is verified, then disable only Life Strong's legacy alerts.
7. Observe cloud convergence on a second device signed into the same iCloud account. Close/reopen and test recovery without the Mac or API; verify both local save and cloud transfer evidence.
8. Owner accepts 7E and a signed standalone build. Record source commit, schema versions, container environment, checksums, import receipt and acceptance evidence. Keep retained backups with an explicit owner-chosen retention period.
9. Retire old API services only after acceptance and a recovery drill. Preserve source/migrations/history as an archive. AWS resources were not created by this task; if any exist independently, the owner inventories them before any billing/deletion decision. Defer repository cleanup to a later reviewed change.

## Rollback and backup rules

Before new native writes, rollback means using the unchanged legacy dataset/app after verifying its queue state; never restore onto the working legacy database just to retry. After native writes begin, PostgreSQL is stale. Export native changes and deliberately reconcile before going back; there is no promised reverse SwiftData-to-PostgreSQL importer. Do not alternate between both apps as simultaneous writers during cutover.

Provide a versioned native export with counts/checksum and a tested import/restore path. Sync is not an independent backup: deletion can propagate. Restore into a disposable local-only store first; restoring old data directly into an active synced store may reintroduce deleted records or duplicate data. Local cache removal, iCloud disconnect and delete-everywhere must be distinct actions with confirmations and tested propagation. Signing-out must not silently delete the only copy.

## Acceptance matrix

| Area | Required proof before native release |
| --- | --- |
| Data | Exact mapped counts/UUIDs/values including archives, targets and history; validation rejects bad files before mutation |
| Retry/recovery | Same package imported twice and crash/restart mid-import produce no duplicates or partial live graph |
| Offline | Cold launch, library edit, new workout, form/set/correction/status/timer save and relaunch work without API/network |
| Sync | Sequential same-account edits converge, partial initial download is explicit, duplicate/conflicting corrections are retained/reviewable |
| Identity | Missing/restricted iCloud, sign-out, different account and reentry preserve account isolation and recoverability |
| Notifications | Permission denial, repeats, rest pause/resume/skip, foreground/background/locked delivery and stale cancellation |
| Analytics | Golden SQL outputs and Swift calculations agree at a frozen instant for each window/timezone and edge case |
| Restore/privacy | Credential-free export round-trip, isolated restore, local-only removal versus cloud deletion, no accidental cross-account upload |
| Device | Native standalone signed install without Expo Go/Metro/Mac; physical VoiceOver/large text and owner acceptance |

Every row remains pending for the native implementation. Legacy Gate 6 acceptance does not count as these native tests passing.

## Phase 7A implementation and next gate

Start 7A with the smallest vertical slice: versioned Exercise, WorkoutTemplate/TemplateExercise, WorkoutSession/SessionExercise and RecordedSet models; local SwiftData container; create two exercises consecutively, start an offline session with a target snapshot, record/save/relaunch, export fixture data and verify counts. Exercise the same model in a signed private CloudKit development container before building all remaining screens. Add/import program and audit models only after compatibility is proven. No destructive schema reset against real data.

## Apple references

- [SwiftData](https://developer.apple.com/documentation/swiftdata) and [schema migration plans](https://developer.apple.com/documentation/swiftdata/schemamigrationplan).
- [SwiftData synchronization across a person's devices](https://developer.apple.com/documentation/swiftdata/syncing-model-data-across-a-persons-devices) documents capabilities and unsupported unique/nonoptional relationship features.
- [CloudKit-compatible store model constraints](https://developer.apple.com/documentation/coredata/creating-a-core-data-model-for-cloudkit) inform the schema feasibility gate; verify SwiftData-specific behavior with the installed SDK.
- [Production CloudKit schema deployment](https://developer.apple.com/documentation/cloudkit/deploying-an-icloud-container-s-schema).
- [Private CloudKit storage](https://developer.apple.com/documentation/cloudkit/ckcontainer/privateclouddatabase) counts toward the user's iCloud allowance.


Phase 7A code now includes the vertical slice above, explicit local persistence, replay-safe recorded-set requests and device-only JSON recovery, with no runtime package or API dependency. Three macOS core XCTest cases pass and simulator UI tests exercise consecutive creation, target/actual distinction, force-quit recovery and completion. The local simulator and unsigned private CloudKit iPhoneOS configurations build. Full schema acceptance and real private delivery still require the owner's signed development rehearsal before expanding to 7B/7C. Native import remains unimplemented.
