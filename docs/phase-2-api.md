# Phase 2 API

All paths start with `/api/v1`. Local, single-user trusted-network development only. JSON request keys are snake_case. IDs and operation IDs are UUIDs. Collection endpoints return arrays; detail/write endpoints return objects. DELETE archives exercises, templates and programs so historical references remain valid. Archived records disappear from browse lists but remain retrievable by ID.

## Resources

| Method | Path | Behavior |
| --- | --- | --- |
| GET, POST | /exercises | Browse or create exercises |
| GET, PUT, DELETE | /exercises/:id | Read, replace metadata, archive |
| GET | /exercises/:id/history | Latest 500 set observations, including unfinished sessions with status |
| GET, POST | /workout-templates | Browse or create templates |
| GET, PUT, DELETE | /workout-templates/:id | Read, replace prescription, archive |
| GET, POST | /programs | Browse or create programs |
| GET, PUT, DELETE | /programs/:id | Read with schedule, replace, archive/deactivate |
| POST | /programs/:id/activate | Set the local active program and start date |
| GET | /schedule | Dated schedule for the active local program |
| GET | /progress?days=30&timezone=America%2FChicago | Completed-session summary, frequency, records, trends and current-program adherence |
| GET, POST | /sessions | Latest 200 sessions, or start a template snapshot |
| GET, PATCH | /sessions/:id | Read full snapshot/sets, or change status |
| POST | /sessions/:id/exercises/:sessionExerciseId/sets | Record one set |
| PUT | /sessions/:id/sets/:setId | Explicit correction of a set, including after completion |

## Request examples

Exercise: `{"name":"Goblet squat","equipment":"Dumbbell","muscle_focus":"Legs","measurement_type":"weight_reps"}`. Types: `reps`, `weight_reps`, `duration`, `distance_duration`. Equipment and muscle focus default to empty strings. The name and type are required.

Template: `{"name":"Strength A","description":"Optional","exercises":[{"exercise_id":"EXERCISE_UUID","prescription":"3 sets of 8","rest_seconds":60}]}`. Array order defines exercise sequence; at least one exercise is required. PUT replaces the full template prescription. Session snapshots remain unchanged. Repeated exercises are supported at different positions.

Program: `{"name":"My program","weeks":12,"schedule":[{"template_id":"TEMPLATE_UUID","week":1,"day":1}]}`. Description is optional. Weeks are 1–104; day 1 is the start-date day, with day 2 the next day. One workout per program/week/day in this phase. An empty schedule is allowed for drafts. Use PUT with the full schedule to edit assignments. Templates can be reused across weeks.

Activation: `{"start_date":"2026-10-19"}`. Exactly one program can be active for the local profile. Archiving it deactivates it. Recurring sessions are represented by explicit weekly assignments in Phase 2.

Start session: `{"template_id":"TEMPLATE_UUID","operation_id":"CLIENT_UUID"}`. Use one operation UUID per logical creation; preserve it for retries. Returns 201 on creation or 200 on a retry. An operation UUID reused for a different template returns 409. Exercise names, types, prescriptions and rest defaults are copied to the session at start time.

Set: `{"operation_id":"CLIENT_UUID","position":1,"reps":8,"weight_kg":12}`. The path uses the **session exercise ID** returned inside the session, rather than the exercise-library ID. Positions begin at 1 and are unique within each session exercise. Reuse the same operation UUID and values for retries: 201 on creation, 200 on matching retry, 409 on conflicting reuse. A paused/completed session rejects new sets; matching retries remain safe after completion.

Required set metrics depend on the snapshotted type:

| Type | Required values |
| --- | --- |
| reps | reps |
| weight_reps | reps, weight_kg |
| duration | duration_seconds |
| distance_duration | distance_meters, duration_seconds |

Extra metrics for another measurement type are rejected. Reps must be positive integers; duration/distance positive numbers; weight nonnegative. Weight is always kilograms and distance meters. Preferred display units are deferred to later settings work.

Status update: `{"status":"paused"}`, `{"status":"active"}`, or `{"status":"completed"}`. Complete only after at least one set has been recorded. A completed session cannot be reopened; repeated completion preserves its completion timestamp. Phase 2 does not require a set for every prescribed exercise before completion.

Correction uses PUT on the existing set ID with its complete `position` and measurement values. It retains the set ID, creation timestamp, and original creation operation ID while updating its timestamp and incrementing `revision`. Legacy requests without correction metadata remain supported.

Phase 4 clients also send a separate correction `operation_id` plus `expected_revision` and `expected_updated_at`. Migration 003 adds version counters and durable receipts: matching correction retries return their original result, conflicting reuse returns 409, and stale versions return 409 STALE_CORRECTION without overwriting the set. Receipts support retries; they are not a full user-facing audit history. An original creation retried after a later correction may return 409 because its old values no longer match. Clients should retrieve/review current records rather than create duplicates.

## Progress semantics added in Phase 5

`GET /progress` accepts days 30/90/365 (default 30) and an IANA timezone (default UTC); unknown parameters, windows and timezones return 400. The result is computed in a consistent read-only transaction. It includes generated_at, date bounds, summary, weekly_frequency, all-time records, windowed daily trends, recent_sessions (up to 20), active_program, adherence and next_workout.

Only completed, server-synchronized sessions count. Dates use the session start time in the requested timezone; training_days is distinct local start dates. Weekly bins start Monday, include zeros and flag partial boundary weeks. All-time maxima are independent values grouped by exercise ID and snapshotted measurement type, preserving distinct measurement histories; they are not combined best sets or estimated one-rep maxima. Corrections are reflected from current recorded values.

Adherence counts current active-program slots due within the selected window, including today and excluding future dates. A slot is matched once by at least one completed session with the same template and local start date. Late workouts still contribute to summary totals. Adherence is null without an active program, and zero due slots have no percentage. This is a report against the current schedule, not an immutable snapshot of past prescriptions. next_workout selects the earliest today/future uncompleted slot with an unarchived template. The frontend uses these fields and exposes mobile program activation through the existing activation endpoint.

## Error and collection limits

Errors have `{"error":{"code":"VALIDATION_ERROR","message":"Invalid request","issues":[]}}`; the issues array is included for schema failures. Invalid JSON/inputs return 400, missing resources 404, conflicting operations or lifecycle states 409, and unexpected server failures 500 without database details. Unknown request keys are rejected. Lists of exercises/templates/programs are currently unpaginated; session and exercise history have fixed limits stated above. Pagination and aggregate progress metrics can follow with Insights work.
