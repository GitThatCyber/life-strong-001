# Phase 3 workout acceptance

Phase 3 adds guided workout execution on iPhone: start a template, navigate exercises, log measurement-specific sets, correct entries, pause/resume, use a rest timer and complete/review the session. Saved workouts can be reopened from Home. Gates 2 and 3 are accepted. The physical iPhone workflow below remains the regression procedure. No database migration is needed for Phase 3.

## 1 Start the services

In Terminal A:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
docker compose up -d postgres
npm run dev:api
```

Leave the API running. In Terminal B:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
npm --prefix frontend ci
npm run check:api
npm run check:ios
npm run test:workout
npm run test:api
npm run test:integration
npm run dev:ios -- --clear
```

Frontend dependencies now include the Expo SDK-compatible `expo-crypto` module for native UUID generation. Preserve both `.env` files and the package lockfiles. The API URL must still use your Mac's current LAN IP; Expo Go needs Local Network access. No forced dependency upgrades or database resets are needed. Existing Phase 2 data must already be migrated/seeded. Open the QR code in Expo Go.

## 2 Complete the strength workout entirely on iPhone

1. Open Browse programs and exercises, select Starter strength, then Open workout.
2. Review the exercise list and tap Start workout. Expect In progress and zero saved sets.
3. For Goblet squat, enter 8 repetitions and 12 kg, then Save set. These are illustrative software-test values; adjust for any actual training. Expect one saved set and a 60-second rest countdown. Fields retain the last values for quick repeated entry.
4. Save another set. Expect set 2, without duplication if you tap quickly. Edit set 1 to 10 repetitions and save the correction. Expect two sets with the corrected value; corrections do not restart the rest timer.
5. Try invalid values (blank reps or a fractional repetition) before saving a new set. Expect an inline error and no new set. Restore valid fields or discard the entry when navigating.
6. Tap +30 sec on the timer, then Skip rest. Tap Start rest to restart the exercise default. Let it reach zero while the app is open; expect Rest complete and a vibration if supported by device settings.
7. Tap Pause workout. Expect the paused state, frozen rest countdown, and unavailable new set entry. Tap Resume workout; expect the timer to resume. Saved sets must remain unchanged.
8. Tap Next exercise to reach Push-up. Expect reps only, with no load/time fields. Record a set.
9. Move to Plank. Expect duration in seconds only. Record a set. Use Previous and the numbered exercise buttons to confirm each exercise retained its own sets.
10. Tap Complete workout and confirm. Expect a completed summary with the saved set count and completion time. The confirmation discloses exercises with no sets; completion requires at least one recorded set overall.
11. Review each exercise's sets in the summary. New set entry is unavailable. Existing sets can be explicitly corrected even after completion.

## 3 Confirm saved-workout continuity

1. Go back to Home and open Continue or review a workout.
2. Open the completed session. Expect the same sets, corrections and completed status. Completed sessions cannot be reopened for training.
3. Start a second workout from Starter strength, save a set, pause it, and go back. In Saved workouts, expect this unfinished session before completed sessions. Open it and resume.
4. Close/reopen the app and reopen the same session from Saved workouts. Expect already saved sets to remain. The selected exercise and rest timer may reset when the workout screen is left; unsaved forms are not persisted in this phase.
5. Enter a new value without saving and try Previous/Next or Back. Expect a discard confirmation. Choose to stay, then save or discard deliberately.

## 4 Verify failed-save recovery

1. With a workout open on the phone, stop the API in Terminal A with Control+C.
2. Enter a new set on the phone and tap Save set. Expect a visible error; the input and pending request remain. Other set edits/exercise navigation are locked until the pending save is resolved.
3. Restart the API with `npm run dev:api`.
4. Tap Retry saving same set. Expect exactly one new set. The same operation UUID and payload are reused, including if the original request reached the server but its response was lost.
5. Alternatively, Reload saved workout can reconcile an uncertain save by retrieving current server records. A confirmation explains that unsaved form changes are discarded. Confirm only when that is intended.
6. Complete the recovered workout and verify it in Saved workouts. This must require no manual API calls.

## 5 Verify distance and timing behavior

1. Open Starter endurance and start a workout. Easy ride should show Distance (meters) and Duration (seconds), with both required. Save illustrative values, complete, and reopen the result.
2. In an active workout, start rest, briefly switch apps, and return. Expect the countdown to reflect elapsed wall time rather than resume from a stale displayed number. The countdown is based on an end timestamp.
3. Rest notifications while backgrounded, recovery of unsaved drafts after force-quit, and durable offline synchronization are Phase 4 work. Do not use this phase to verify background notification delivery. Foreground alerts may vary with device vibration settings.

## Gate 3 checklist

Accepted October 16, 2026, based on the user's confirmation that Gate 3 was tested with successful results. Device results are user-reported; individual device-test logs were not independently captured.

- [x] Automated typechecks, workout tests and existing API/database tests pass.
- [x] A complete strength session is recorded and completed on iPhone without manual API calls.
- [x] Reps/load, reps-only, duration, and distance/duration entry work with correct units.
- [x] Previous/Next and exercise selection retain each exercise's saved data.
- [x] Corrections work, including after completion; no duplicate sets appear after retries.
- [x] Pause/resume, rest completion, +30 seconds, skip and foreground return behave as described.
- [x] Unsaved-entry confirmations and failed-save recovery work.
- [x] Saved workouts survive app reopening and completed summaries match recorded values.

Gate 3 acceptance is recorded in MEMORY.md. Retain this checklist for regression testing; automated tests and bundle export alone do not establish physical-device usability.
