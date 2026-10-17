# Life Strong native foundation

Phase 7A implements a separate SwiftUI rehearsal app, versioned SwiftData v1 models, explicit local saves and device-only recovery. It does not replace the accepted Expo app or import real training data. It has no third-party package dependency, API URL, server login or AWS dependency.

Open LifeStrong.xcodeproj and select the **LifeStrong** scheme for the local-only build. It installs as **Life Strong Lab**, bundle com.vineandvolt.lifestrong.rehearsal. Local and CloudKit rehearsals use separate bundle IDs and stores. No startup code resets a store or replaces a failed open with an empty database.

From the repository root:

```bash
swift test --package-path ios-native
xcodebuild -project ios-native/LifeStrong.xcodeproj -scheme LifeStrong -sdk iphonesimulator -configuration Debug -derivedDataPath /private/tmp/life-strong-native-build CODE_SIGNING_ALLOWED=NO build
```

For UI tests, select an installed iPhone simulator using Xcode's destination menu, or use its UUID from xcrun simctl list devices available:

```bash
xcodebuild -project ios-native/LifeStrong.xcodeproj -scheme LifeStrong -destination 'platform=iOS Simulator,id=YOUR_SIMULATOR_UUID' -derivedDataPath /private/tmp/life-strong-native-build CODE_SIGNING_ALLOWED=NO test
```

The two UI tests use unique fixture namespaces, create two exercises consecutively, builds a target workout, logs actual results and verifies force-quit/relaunch recovery. It never resets the normal local store or uses CloudKit. A repeated-session test also verifies returning to the same preview can start a distinct workout. Core XCTest tests run the same models/repository on macOS, including on-disk reopen, all metric types, history snapshots, replay/conflict validation, device recovery and credential-free diagnostic export counts.

## Implemented vertical slice

- Four exercise measurement types, equipment/muscle focus and save/create-next.
- Workouts with add/remove/reorder, repeated exercises, optional structured targets, rest and instructions.
- Offline session snapshot/start, actual set entry, durable pending record identity/replay, pause/resume/completion.
- Saved sessions and device-only input/selection/rest deadline recovery.
- Versioned diagnostic JSON export of six model collections and counts. This is not the Phase 7B migration format and has no implemented importer/restore yet; do not treat it as your only backup.
- VersionedSchema and SchemaMigrationPlan v1; optional inverse relationships/default-backed fields without unique constraints.

Not included yet: legacy import, native programs/progress, library editing/archive UI, corrections/conflict resolution, notification delivery, production account lifecycle and complete backup/restore. Continue using the accepted legacy app for real training until native cutover.

## CloudKit rehearsal

The separate **LifeStrongCloudKitRehearsal** scheme runs CloudKitDebug with a different app identity, private .rehearsal container, development entitlements and background remote-notification capability. It does not copy the local-only store into iCloud. Owner-managed paid signing/container setup and real device sync verification are still required. Merely compiling this configuration does not verify account access, schema initialization or cloud delivery.

Only disposable fixture data belongs in this scheme. It verifies account availability before opening and locks the UI after an account-change notification; complete persistent account isolation/recovery belongs to 7D. Do not switch Apple accounts during a rehearsal or use this as production data protection. The UI never claims a successful local save proves sync.

Follow [Phase 7A end-to-end instructions](../docs/phase-7a-testing.md) for Xcode/account setup, fixture tests and evidence to return. No account/container/certificate/schema actions have been performed by Codex.

## Project maintenance

Core/ contains models, validation, persistence, recovery and diagnostic export. App/ owns startup/store configuration. Features/ contains the SwiftUI vertical slice. Package.swift exposes Core/ as LifeStrongCore for native tests, while the Xcode app compiles the same source files directly.

The checked-in Xcode project has no generator dependency. To regenerate it after adding files:

```bash
python3 ios-native/scripts/generate-project.py
```

This rewrites the project/shared schemes and plist/entitlement templates. Reapply any personal signing/team overrides afterward; do not commit signing credentials. Build products, Swift package caches, test results and Xcode personal state are ignored. Retain native stores/export files privately outside source control.
