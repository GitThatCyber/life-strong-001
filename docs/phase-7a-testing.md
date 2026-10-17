# Phase 7A native foundation setup and acceptance

Phase 7A development provides a native rehearsal app alongside the accepted legacy app. It saves training directly in SwiftData and recovers device-local forms/timers. No real legacy data import, API replacement cutover, AWS setup or Apple account operation has been performed. Keep using the accepted app for real workouts while testing this foundation with clearly labeled fixtures.

## 1 Preserve the accepted application

Keep frontend/, backend/, database/, deployment/, their .env files, PostgreSQL volumes and Expo storage. Do not uninstall Expo Go, clear its pending queue or move it to a different endpoint. No migration of real data occurs in 7A. The rehearsal app uses com.vineandvolt.lifestrong.rehearsal instead of the proposed final app identifier.

Xcode 27.0 (27A266a) is installed on this Mac. The app's deployment target is iOS 17; automated UI testing uses an installed iOS 26.5 iPhone simulator. Actual owner-device and older-supported-OS acceptance are separate from successful compilation.

## 2 Run the local automated tests

From the repository root:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
swift test --package-path ios-native
```

Expected: three native XCTest cases pass, covering a persistent store reopen and snapshot/export round-trip; all four measurement types/validation/retry conflicts; and device draft/lost-acknowledgement recovery. Tests create only their own temporary fixture folders. No cloud account is required, and no third-party Swift package is downloaded.

Build the simulator app:

```bash
xcodebuild -project ios-native/LifeStrong.xcodeproj -scheme LifeStrong -sdk iphonesimulator -configuration Debug -derivedDataPath /private/tmp/life-strong-native-build CODE_SIGNING_ALLOWED=NO build
```

Expected: BUILD SUCCEEDED. This is an unsigned simulator build, not a signed iPhone installation.

List installed devices:

```bash
xcrun simctl list devices available
```

Use an available iPhone UUID below:

```bash
xcodebuild -project ios-native/LifeStrong.xcodeproj -scheme LifeStrong -destination 'platform=iOS Simulator,id=YOUR_SIMULATOR_UUID' -derivedDataPath /private/tmp/life-strong-native-build CODE_SIGNING_ALLOWED=NO test
```

Expected: two UI tests pass consecutive exercise creation, planned-vs-actual values, forced app termination/relaunch with a saved set and unsaved form, completion and distinct sessions from the same preview. Each UI run uses a separate fixture namespace and never wipes the app's ordinary rehearsal store.

## 3 Launch the local rehearsal app in Xcode

Open ios-native/LifeStrong.xcodeproj. Choose scheme **LifeStrong**, an iPhone simulator destination, and Product → Run (Command+R). The app appears as **Life Strong Lab**. Expect “Local training library” and “Cloud sync is off in this build.” No API or Mac-hosted PostgreSQL is involved in its runtime.

For a physical iPhone, connect/trust it, enable Developer Mode if requested, and select it as the destination. In Xcode Settings → Accounts, sign in yourself. Under the LifeStrong target's Signing & Capabilities select your own team and automatic signing for Debug. Verify the rehearsal identifier is available in your team; use a different owned rehearsal identifier if necessary. Do not choose the final production bundle or replace the existing app.

A free Personal Team may support local-only testing with short-lived provisioning; paid Developer membership is needed for the CloudKit portion. Codex has not enrolled, signed, registered an identifier or created certificates on your behalf.

## 4 Create exercises consecutively

Tap Create exercise. Save these fixtures without leaving the screen:

| Name | Measurement | Equipment and muscle focus |
| --- | --- | --- |
| Lab squat | Weight and repetitions | Dumbbell, legs |
| Lab lunge | Repetitions | Bodyweight, legs |
| Lab plank | Duration | Mat, core |
| Lab ride | Distance and duration | Bike, endurance |

After every confirmed save, expect a named confirmation, cleared fields, default Repetitions type and focus on Name for the next exercise. Return to Home and verify all four names/types. Blank names cannot save. A failed validation keeps values visible. Back with an unsaved exercise asks before discarding.

Exercise/library editing and archive screens arrive in 7C. Do not interpret their absence in this vertical slice as removal from the approved final scope.

## 5 Build a target workout entirely offline

Turn on Airplane Mode for the physical iPhone, or disable the simulator's network using the available test controls. The local scheme never makes an API request, even when the Mac's network is available.

Create workout → name Lab mixed workout → Add exercise. Add all four fixtures and enter:

| Exercise | Targets | Rest |
| --- | --- | --- |
| Squat | 3 sets, 8 reps, 12 kg | 60 seconds |
| Lunge | 2 sets, 10 reps | 30 seconds |
| Plank | 2 sets, 45 seconds per set | 15 seconds |
| Ride | 1 set, 600 seconds, 2000 meters | 0 seconds |

Add instructions. Move entries up/down, remove/readd one, and optionally repeat an exercise as two distinct entries. Verify values stay with their entry. Blank targets remain unspecified; zero load/rest are valid. Try fractional sets, zero repetitions and invalid duration; expect a readable error and retained form. Correct values, save and reopen the workout preview from Home.

No plan is fetched from the legacy server. Target fields are distinct from actual results and do not automatically create sets.

## 6 Start, record and recover

1. Tap Start workout offline. Verify the session exercise order, name/type, target snapshot and rest defaults.
2. Log squat actuals of 6 reps at 10 kg against the planned 8 reps/12 kg. Expect exactly one saved set and the plan unchanged.
3. Select each other exercise and log its matching actual fields; inappropriate metric fields must not appear. No Mac/API/network is needed.
4. Begin another actual entry but do not record it. Force-quit the app, reopen, and open the saved active session from Home. Verify the saved sets, selected exercise, unfinished form and rest deadline survive.
5. Let time pass while backgrounded; the foreground rest countdown should recompute from its deadline instead of restarting. Pause/resume should freeze/restore remaining rest; Skip cancels it. Native scheduled alerts are not implemented until 7C.
6. Attempt to complete an empty session: expect a validation error. After recording a set, complete and confirm. Reopen: status is Completed, actual sets/targets persist and the session cannot be resumed for new set recording.
7. Return to the same template preview and start another session deliberately. It must create a new session; double taps on a single start must not create duplicates. Existing sessions remain on Home.
8. Repeat force-quit/reopen while still offline. Test keyboard scrolling, VoiceOver field labels and Larger Accessibility Sizes on your iPhone.

The unit tests simulate termination after a set commits but before its local pending request is cleared: replay must acknowledge the same set once. A genuine storage-open error must remain visible; do not clear app data to bypass it. No startup code silently replaces a failed store with an empty one.

## 7 Export diagnostic fixture data

From Home tap Export foundation snapshot and save the JSON through Files. This is format life-strong-native-foundation version 1, not the future SQL migration package. Inspect counts for exercises, templates, templateExercises, sessions, sessionExercises and recordedSets. For the four-exercise/four-entry/one-session test, expect 4/1/4/1/4 and your actual recorded-set count; repeated entries/sessions change those counts deliberately.

Verify IDs, canonical values, target snapshots and actual results are separate. There must be no passwords, bearer tokens or database connection string. No native importer or full restore exists yet; retain the original legacy data/backups. Device-only forms are not included in this diagnostic snapshot.

## 8 Prepare a private CloudKit development rehearsal

This portion is performed by you in Xcode/Apple's developer account. Use only disposable fixture data and the same intended Apple account throughout. Complete account-switch isolation and production recovery are later 7D gates.

1. Confirm your Apple Developer Program enrollment is active and you can manage identifiers/containers. An Apple account alone is insufficient.
2. Open the LifeStrong target's Build Settings. Select **CloudKitDebug**, set your Development Team and verify a separate available bundle identifier. Default proposal: com.vineandvolt.lifestrong.cloud-rehearsal.
3. Register or select a separate private rehearsal container in your Apple team: proposed iCloud.com.vineandvolt.lifestrong.rehearsal. The source guard requires the identifier to end with .rehearsal so this scheme cannot casually target the proposed final container.
4. Set LIFE_STRONG_CLOUDKIT_CONTAINER for CloudKitDebug to that exact container identifier. The checked-in Config/CloudKitRehearsal.entitlements file uses the same build setting. Keep iCloud services limited to CloudKit and verify development provisioning matches it.
5. In Signing & Capabilities verify iCloud → CloudKit and the selected rehearsal container. Verify Background Modes → Remote notifications; Config/CloudKitInfo.plist already contains remote-notification. Development APS/iCloud entitlements are prepared, but Xcode must obtain a matching signed profile through your team.
6. Select scheme **LifeStrongCloudKitRehearsal**, the physical device signed into your intended iCloud account, and Run. Xcode's account/provisioning prompts are yours to complete. No production schema publication is needed in 7A.
7. Expect **Life Strong Cloud Lab**, “Private iCloud rehearsal” and an initially separate fixture library. The local-only store is not copied into cloud storage. If account/store setup fails, expect an error without a silent reset or fallback to an empty local store.
8. Create a clearly labeled cloud fixture exercise/template/session and record one set. Inspect development schema/log diagnostics in CloudKit Console to confirm schema/model acceptance. If you have a second signed test device with the same account/container and development build, pull to refresh the Home library (or close/reopen) and verify those fixtures eventually appear there. Do not import the local fixture export on both devices.
9. Keep local saves distinct from cloud confirmation. A successful local save, an unsigned build or “account available” alone does not prove records were uploaded. Capture actual development sync evidence and any framework errors; do not reset a real container to fix a mismatch.
10. Do not switch Apple accounts during this rehearsal or use production/personal history. The account-change notification locks the running UI and preserves files, but the full account-binding/lifecycle design remains unimplemented for 7D.

For compilation only, without signing/account access:

```bash
xcodebuild -project ios-native/LifeStrong.xcodeproj -scheme LifeStrongCloudKitRehearsal -configuration CloudKitDebug -sdk iphoneos -derivedDataPath /private/tmp/life-strong-native-cloud-build CODE_SIGNING_ALLOWED=NO build
```

This build has been verified locally; it does not prove entitlements, registered container access, schema initialization or sync. Do not install/archive this unsigned output as a release.

## Gate 7A evidence

- [x] Versioned SwiftData models and migration plan compile; no third-party Swift dependency or API runtime required.
- [x] Native core tests pass persistence/reopen, targets/history, validation, replay and device-recovery checks.
- [x] Local simulator app builds and automated creation/record/relaunch/completion workflow passes.
- [x] Separate CloudKit rehearsal configuration compiles unsigned for iPhoneOS.
- [ ] Owner's physical iPhone passes local/offline/relaunch and accessibility checks.
- [ ] Owner verifies paid signing, rehearsal entitlements/container and actual private development model acceptance/sync evidence.
- [ ] Owner accepts Gate 7A after those remaining checks. Native implementation is ready for this acceptance sequence, not yet accepted or ready for real-data cutover.

Return the physical test result, whether CloudKit schema initialized/synced, and any exact error text with personal identifiers/tokens removed. Gates 7B–7E and the final native release remain open.
