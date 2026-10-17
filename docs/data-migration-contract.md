# Life Strong migration data contract

Planning specification version 1, October 17, 2026. This contract is not an implemented exporter/importer. No working data has been exported or converted by this documentation update.

## Migration package

Build a versioned, credential-free JSON package from a repeatable-read PostgreSQL snapshot after the legacy phone queue is reconciled. Do not feed pg_dump directly to SwiftData and do not copy PostgreSQL/Expo SQLite files into a SwiftData store. A custom-format SQL dump remains the independent rollback backup.

The existing GET /account/export endpoint is useful for inspection but insufficient as the sole migration artifact: it has no schema version/checksum/count manifest, excludes correction receipts, and cannot access phone-only drafts/preferences. Implement a dedicated read-only snapshot exporter plus a legacy device recovery export before importing real data. Never enable owner auth or change production credentials just to bypass this gap.

The package contains:

| Member | Required meaning |
| --- | --- |
| format | life-strong-migration |
| format_version | 1; reject unsupported versions before writing |
| export_id | UUID for this immutable snapshot, reused when retrying the same import |
| source_dataset_id | Locally recorded stable dataset UUID; no password-bearing connection string |
| captured_at | ISO 8601 UTC timestamp |
| source_migrations | Ordered applied SQL migration filenames, expected through 005 |
| rows | Full table arrays listed below, including archived/inactive records |
| counts | Count per table before conversion and expected native counts |
| device_recovery | Optional separately versioned device-only package or explicit not-exported status |
| exclusions | Credential/service tables intentionally omitted |

Keep a separate manifest with SHA-256 of the exact UTF-8 package bytes and a source-release identifier. Do not embed a hash of a file inside that same file. Verify the manifest before decoding/importing. A checksum detects accidental changes, not the identity/trustworthiness of a file. Require deliberate user file selection and show a preview before committing.

## Entity and field mapping

| Legacy source | Proposed native destination | Fields and invariants |
| --- | --- | --- |
| exercises | Exercise | Original UUID, name/equipment/muscle focus/type, archive flag, timestamps, revision |
| workout_templates | WorkoutTemplate | Original UUID, name/description/archive/revision/timestamps |
| template_exercises | TemplateExercise | Original UUID and references, explicit zero-based position, prescription/rest and all five nullable target fields |
| programs | TrainingProgram | Original UUID, name/description, weeks, archive/revision/timestamps |
| program_schedule | ProgramSlot | Original UUID, program/template IDs, week and day; day 1 is the program start date |
| user_programs | ProgramEnrollment | Stable ID derived from original program UUID, program link, date-only start, active flag, update timestamp; do not reinterpret a date as UTC midnight in another timezone |
| workout_sessions | WorkoutSession | Original UUID and start operation UUID, template ID/name snapshot, status, started/completed/updated timestamps |
| session_exercises | SessionExercise | Original UUID and links, name/type/prescription/rest/order plus nullable target snapshots; never rebuild from today's template |
| exercise_sets | RecordedSet | Original UUID, operation UUID, position, actual reps/kg/seconds/meters, original timestamps and current revision |
| set_correction_receipts | LegacyCorrectionAudit | Operation UUID, set reference, exact request/response JSON and available timestamps; retain as migration audit, not a request to replay |
| library_write_receipts | Recovery archive only | Do not replay library saves or import them as extra exercise/template/program records; retain securely with the original rollback backup |
| schema_migrations, seed_history | Import provenance | Preserve filenames/dates as provenance, not executable native migrations |
| app_owner | Migration provenance only | Single-owner legacy ID can identify source ownership; do not import email/password as native account credentials |
| auth_sessions | Excluded | No bearer tokens, session hashes, passwords or auth state in the native app/package |

Preserve unknown legacy source metadata in a recovery report rather than silently dropping it. Counts for mapped records must match exactly; explain intentional exclusions separately. Preserve a complete SQL dump so excluded legacy recovery data remains available without becoming live native data.

All nullable targets and metrics retain null; null must not become zero. Zero load and zero rest remain valid. Preserve seconds/meters/kilograms without rounding or unit conversion. Dates representing instants retain timezone offsets/precision as instants; program start_date remains calendar components. New imports do not infer target sets/reps from prescription prose. Templates may repeat the same exercise in separate rows. Sort explicitly by position and stable UUID, never relationship-array iteration order.

RecordedSet captures the current corrected state at migration time. Earlier original values cannot always be reconstructed from existing receipts, so never invent a complete original-value audit trail. Preserve available receipts and mark the native baseline as imported current state. New native corrections need their own explicit audit design.

## Validation before any write

Reject malformed/duplicate UUIDs, orphan references, conflicting operation UUIDs, invalid types/statuses/units, nonfinite/out-of-range numbers, duplicate child positions, duplicate week/day slots, invalid dates and multiple active enrollments. Archived exercise/template links needed for history must remain resolvable. Missing required values are errors, not occasions to invent UUIDs/names/dates. File size/depth/entity limits and recoverable file errors must be implemented before allowing arbitrary imports.

The legacy server uses local single-owner constraints; validate ownership consistency without migrating server passwords. Capture table counts and per-entity normalized fingerprints, including archived records, target snapshots, actual metrics and UTC timestamps. Compare analytics from the same captured date/window/timezone; checking only completed-session totals is insufficient.

## Device recovery and queue boundary

The Expo app stores endpoint-scoped workout snapshots, forms, timers, operation IDs and queued writes in expo-sqlite/kv-store; reminder preferences use a separate key. A Swift app cannot assume access to Expo Go's sandbox. Implement an explicit legacy recovery export/share action that includes version, source endpoint identity without credentials, capture time, local workout state and reminder preferences. Exclude SecureStore tokens and passwords. Swift imports this file through the user's chosen Files location.

Default route: synchronize queues and ambiguous starts against the original API, verify no blocked writes remain, freeze legacy writes, then export PostgreSQL plus device recovery. Unresolvable pending writes block cutover. Do not silently discard them or replay HTTP requests from the native app. An exceptional unsynced recovery needs an explicit per-operation reconciliation report against the SQL snapshot before import; this is not automatic conflict merging.

Import device drafts/timers only when referenced sessions/exercises resolve. Restore future deadlines as dates and recompute elapsed time; expired timers must not trigger duplicate alerts. Transfer reminder choices but request native notification permission anew; Expo notification IDs/permissions are not transferable. Reconcile/cancel only Life Strong's legacy schedules after native alerts are confirmed, without clearing other Expo projects' data.

## Import and retry rules

1. Verify package/manifest, schema, graph and counts. Show an import preview, including exclusions and unresolved device state.
2. Rehearse in a disposable local-only ModelContainer. Import in dependency order and compare fingerprints/analytics before cloud publication.
3. On the designated import device only, import into an empty native destination for the verified owner/environment. Do not import on multiple devices into the same private database.
4. Serialize imports. Retain original domain UUIDs, keep an ImportReceipt/export_id and durable progress, and persist through explicit save boundaries. Handle crashes by fetching UUIDs and verifying payloads rather than inserting a second copy. A conflicting existing UUID blocks import instead of overwriting newer work.
5. Make failure recovery atomic where the store API permits; otherwise use staging/resumable batches and leave partial imports hidden from normal training UI. A completed ImportReceipt is written only after the full validation pass.
6. A second import of the identical package is a verified no-op. A different snapshot requires deliberate preview/reconciliation; it cannot overwrite a native store already receiving new workouts.
7. Cloud synchronization is asynchronous and not part of a cross-device atomic import. Keep secondary writers disabled until the first import and second-device graph verification complete. Framework-managed sync alone does not enforce global UUID uniqueness.

Preserve the source files, SQL dump and device recovery separately until native local, sync and recovery gates are accepted. Keep exports in a protected location and never commit personal data to Git.
