# Phase 6 training customization setup and acceptance

Gate 6 was accepted by the owner October 17, 2026, after testing and the consecutive exercise creation follow-up. Individual device logs were not independently captured. It adds native exercise, workout and program editors, optional structured targets and safe library changes. Gates 1–5 remain accepted. This procedure does not deploy or push anything.

## 1 Preserve existing data

Synchronize all pending iPhone workout changes. Keep the exact API endpoint and existing .env files. Stop the API with Control+C. From Terminal A:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
docker compose up -d postgres
mkdir -p backups
docker compose exec -T postgres pg_dump -U lifestrong -d lifestrong -Fc > backups/before-phase-6.dump
npm run verify:backup -- backups/before-phase-6.dump
```

Use a fresh backup filename if one already exists. Expect restored migration/exercise/session counts and PASS. Stop if verification fails. These commands target the development Docker database; a different PostgreSQL instance needs its own backup and isolated restore verification. Never reset volumes.

## 2 Apply additive migrations and run tests

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm run db:migrate
npm run db:migrate
npm run check
npm run test:integration
npm run test:release-image
```

The first migration run applies any missing migrations, including 004 owner setup and 005 customization; the second skips them. Migration 004 assigns existing records to the singleton owner but does not enable authentication by itself. Keep your existing AUTH_MODE and EXPO_PUBLIC_AUTH_MODE aligned; follow private-release-runbook.md separately if enabling owner authentication. Do not disable an existing owner-mode deployment.

Migration 005 adds optional target columns and revisions; existing prescriptions and history remain unchanged. No targets are inferred from old prose. Tests pass: two typechecks, 19 frontend tests, three API/configuration tests, 12 PostgreSQL suite nodes and the hardened container checks. The normal check command skips database integration; the separate integration command runs it in a unique temporary schema. The container test uses disposable PostgreSQL memory storage, not your working volume.

No new package dependency is needed. The existing frontend dependency advisory review remains open.

## 3 Restart API and Expo

Terminal A, from the root:

```bash
npm run dev:api
```

Terminal B:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
npm run dev:ios -- --clear
```

Open Expo Go on the same Wi-Fi and load Life Strong. If owner mode is enabled, sign in. Open Training library from Home. Expect Create exercise, Create workout and Create program buttons. Existing records should remain visible.

## 4 Customize exercises

Create four test exercises with clearly recognizable names:

| Name | Measurement type | Suggested fields |
| --- | --- | --- |
| Gate 6 squat | Weight and repetitions | Equipment Dumbbell, muscle focus Legs |
| Gate 6 lunge | Repetitions | Equipment Bodyweight, muscle focus Legs |
| Gate 6 plank | Duration | Equipment Mat, muscle focus Core |
| Gate 6 ride | Distance and duration | Equipment Bike, muscle focus Endurance |

Save each without leaving the create page. After a confirmed save, expect a named confirmation, cleared exercise fields, the default Repetitions type, and focus on Name for the next exercise. Create at least two in a row, then return to the library and tap Edit exercise. Verify all fields persist. Change a name/equipment value and save again. Blank names must fail without losing the form. Save needs a connection. Exercise creation stays in create mode after each confirmed save; editing an existing exercise stays in edit mode. Workout/program creation still switches to editing the saved item. A failed or uncertain exercise save retains its values and Retry save request; it must not clear the form or create duplicates.

## 5 Build a customized workout

1. Tap Create workout. Name it Gate 6 mixed workout and enter a description.
2. Add each test exercise using Add exercise and search.
3. For squat set targets to 3 sets, 8 reps, 12 kg and 60 seconds rest. For lunge use 2 sets, 10 reps and 30 seconds rest. For plank use 2 sets, 45 seconds per set and 15 seconds rest. For ride use 1 set, 600 seconds and 2000 meters, with zero rest.
4. Add instructions. Move exercises up/down; remove an entry and add it again. Verify order and remaining values stay attached to the correct exercise. Duplicate exercise entries are allowed and remain separate.
5. Save, leave, reopen Edit workout and verify all targets, units, instructions and order. Blank targets mean unspecified; zero load is valid, zero rest is valid. Planned reps/sets/duration/distance must be positive; sets/reps must be whole numbers.
6. Try target sets 1.5, repetitions 0, negative load and an empty rest field. Each must fail without clearing input. Correct the values before saving.
7. Change any field and tap Back. Keep editing must preserve it; Leave must discard the unsaved form. Library forms are not durable after closing the app, signing out or an authentication reset. Save while connected before leaving.

Targets apply per set, and are shown separately from actual recorded values. A total timed effort can be represented as one duration set. Editing a plan does not manufacture actual sets or enforce a maximum number performed.

## 6 Build and activate a program

1. Tap Create program, name it Gate 6 program and choose 2 weeks.
2. Assign the custom workout to week 1/day 1 and week 2/day 3. Enter each slot's week/day explicitly; each newly added slot initially shows week 1/day 1.
3. Try duplicate week/day slots, day 8, and week 3. Expect validation errors with the form retained. Correct them and save.
4. Reopen Edit program and confirm length, description and slots. Remove a slot, reassign a workout, change the length and save/reopen again.
5. Open program details and Activate program today. Confirm only if replacing your current active program is acceptable. Day 1 means the activation start date, not necessarily Monday. Progress should show the new schedule.

Editing an active program changes its current schedule and adherence calculation; it does not change saved session observations. Record your original active program so you can reactivate it after testing.

## 7 Verify targets and history

1. Open the custom workout. Preview must show planned targets. Start it and confirm each exercise has the correct type, order, targets and rest default.
2. Record actual values different from the plan, such as 6 reps at 10 kg against the 8-rep/12-kg target. Log the timed and distance efforts using their corresponding fields. You may record more or fewer sets than planned.
3. While this session remains active, return to the library and edit its template targets/order/name. Reopen the saved session: its original plan snapshot and existing results must remain unchanged.
4. Complete the session and synchronize. Edit the template/exercise again; the completed session must retain its original name, type, targets, exercise order and actual results.
5. Start another session from the updated template. It must use the updated plan. Complete it with real entries if you want to keep it; tests add real training history and are not automatically deleted.
6. Cache an active workout, stop the API, record a set, force-quit/reopen and reconnect. Queued writes and target snapshots must survive and synchronize once. Repeat a locked-screen rest notification from the Phase 4 procedure.

## 8 Failure handling and archives

1. Open an existing editor while connected. Stop the API, change a field and Save. Expect an error with all values retained. Editing is locked while the save result is uncertain. Restart the API and tap Retry save; expect one saved item. Do not close the app during this test.
2. Retry sends the exact same operation ID and payload. A confirmed validation/conflict rejection unlocks the form for correction. A stale edit requires Reload from server after you have reviewed/copied any values you want to keep. Reload explicitly discards the editor changes.
3. Automated tests cover concurrent create retries, stale revisions, incompatible type changes and archive conflicts. To manually provoke a stale edit, open the same record on two devices, save one, then attempt to save the older form on the other.
4. Try archiving a test exercise still used by the custom workout. Expect a clear instruction to remove it from the workout first. Try archiving the workout while used by the custom program; expect the equivalent program reference safeguard.
5. To clean up the test library, archive the test program first, then the test workout, then the test exercises. Archiving the active program deactivates it. Completed sessions remain available with their original snapshots.
6. To change an exercise measurement type, first clear incompatible targets from every linked workout and save those workouts. Then change the type. Reopen affected workout editors and set appropriate new targets. Existing sessions preserve the original type.
7. Check VoiceOver labels, selected measurement type, confirmation dialogs, keyboard scrolling and large text on all three editors.

Do not use account deletion as test cleanup on your real account. Archives hide library items and preserve history; a restore/unarchive UI is not included in Phase 6.

## Gate 6 checklist

- [x] Four exercise types created, edited and reopened on iPhone.
- [x] Workouts support adding/removing/reordering exercises and all applicable structured targets/rest/instructions.
- [x] Programs support week/day scheduling, editing and activation without manual API calls.
- [x] Session targets and actual results stay distinct; active/completed history survives library edits.
- [x] Validation, unsaved-change confirmation, failed-save retry and archive safeguards work.
- [x] Offline workout recovery/sync, reminders, VoiceOver and large text pass regression checks.
- [x] Owner confirmed Gate 6 acceptance October 17, 2026.

Private release still needs the remaining release-checklist.md gates. No push, hosting deployment or signing was performed by this phase.
