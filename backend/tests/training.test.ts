import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import request from 'supertest';

test('Training PostgreSQL and API acceptance (Phases 2–6)', { skip: process.env.RUN_DB_TESTS !== '1' }, async t => {
  assert.ok(process.env.DATABASE_URL, 'Configure backend/.env first');
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  const schema = `phase2_test_${randomUUID().replaceAll('-','')}`;
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const original = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url.toString();
  const { app } = await import('../src/app.js');
  const { pool } = await import('../src/db/pool.js');
  const run = promisify(execFile);
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const exerciseId = '10000000-0000-4000-8000-000000000001';
  const templateId = '20000000-0000-4000-8000-000000000001';
  const programId = '30000000-0000-4000-8000-000000000001';
  try {
    await t.test('real migration and seed commands are repeatable', async () => {
      await run(process.execPath,['--import','tsx','src/db/migrate.ts'],{ cwd,env: process.env });
      const second = await run(process.execPath,['--import','tsx','src/db/migrate.ts'],{ cwd,env: process.env });
      assert.match(second.stdout,/Skipped 002_training.sql/);
      assert.match(second.stdout,/Skipped 005_training_customization.sql/);
      await run(process.execPath,['--import','tsx','src/db/seed.ts'],{ cwd,env: process.env });
      await run(process.execPath,['--import','tsx','src/db/seed.ts'],{ cwd,env: process.env });
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM exercises')).rows[0].n,4);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM program_schedule')).rows[0].n,24);
    });
    await t.test('validation, stable errors and exercise CRUD', async () => {
      const emptyProgress = await request(app).get('/api/v1/progress?days=30&timezone=UTC').expect(200);
      assert.equal(emptyProgress.body.summary.completed_sessions,0);
      assert.deepEqual(emptyProgress.body.records,[]);
      await request(app).get('/api/v1/progress?days=31').expect(400);
      await request(app).get('/api/v1/progress?timezone=Not_A_Zone').expect(400);
      const invalid = await request(app).post('/api/v1/exercises').send({ name: '',measurement_type: 'bad' }).expect(400);
      assert.equal(invalid.body.error.code,'VALIDATION_ERROR');
      await request(app).get('/api/v1/exercises/not-a-uuid').expect(400);
      await request(app).get(`/api/v1/exercises/${randomUUID()}`).expect(404);
      const input = { name: 'Custom lunge',measurement_type: 'reps',equipment: 'Bodyweight',muscle_focus: 'Legs' };
      const created = await request(app).post('/api/v1/exercises').send(input).expect(201);
      await request(app).put(`/api/v1/exercises/${created.body.id}`).send({ ...input,name: 'Updated lunge' }).expect(200);
      await request(app).delete(`/api/v1/exercises/${created.body.id}`).expect(204);
      assert.ok(!(await request(app).get('/api/v1/exercises')).body.some((e: {id: string}) => e.id === created.body.id));
      const malformed = await request(app).post('/api/v1/exercises').set('Content-Type','application/json').send('{').expect(400);
      assert.equal(malformed.body.error.code,'INVALID_BODY');
    });
    await t.test('template/program writes roll back on invalid references', async () => {
      const before = (await pool.query('SELECT count(*)::int AS n FROM workout_templates')).rows[0].n;
      await request(app).post('/api/v1/workout-templates').send({ name: 'Invalid',exercises: [{ exercise_id: randomUUID() }] }).expect(404);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM workout_templates')).rows[0].n,before);
      await request(app).post('/api/v1/programs').send({ name: 'Invalid week',weeks: 1,schedule: [{ template_id: templateId,week: 2,day: 1 }] }).expect(400);
      const template = await request(app).post('/api/v1/workout-templates').send({ name: 'Custom template',exercises: [{ exercise_id: exerciseId }] }).expect(201);
      const program = await request(app).post('/api/v1/programs').send({ name: 'Custom program',weeks: 2,schedule: [{ template_id: template.body.id,week: 1,day: 2 }] }).expect(201);
      await request(app).put(`/api/v1/programs/${program.body.id}`).send({ name: 'Updated program',weeks: 2,schedule: [] }).expect(200);
      await request(app).delete(`/api/v1/programs/${program.body.id}`).expect(204);
      await request(app).delete(`/api/v1/workout-templates/${template.body.id}`).expect(204);
    });
    await t.test('activate program and return dated schedule', async () => {
      await request(app).post(`/api/v1/programs/${programId}/activate`).send({ start_date: '2026-10-19' }).expect(200);
      const schedule = await request(app).get('/api/v1/schedule').expect(200);
      assert.equal(schedule.body.length,24);
      assert.equal(schedule.body[0].week,1);
      assert.equal(new Date(schedule.body[0].scheduled_date).toISOString().slice(0,10),'2026-10-19');
    });
    await t.test('session retries, set measurements, corrections and immutable snapshots', async () => {
      const input = { template_id: templateId,operation_id: randomUUID() };
      const [a,b] = await Promise.all([request(app).post('/api/v1/sessions').send(input),request(app).post('/api/v1/sessions').send(input)]);
      assert.deepEqual([a.status,b.status].sort(),[200,201]);
      assert.equal(a.body.id,b.body.id);
      const session = a.body, e = session.exercises[0];
      await request(app).patch(`/api/v1/sessions/${session.id}`).send({ status: 'completed' }).expect(409);
      await request(app).post('/api/v1/sessions').send({ ...input,template_id: '20000000-0000-4000-8000-000000000002' }).expect(409);
      const setPath = `/api/v1/sessions/${session.id}/exercises/${e.id}/sets`;
      await request(app).post(setPath).send({ operation_id: randomUUID(),position: 1,duration_seconds: 30 }).expect(400);
      const setInput = { operation_id: randomUUID(),position: 1,reps: 8,weight_kg: 12 };
      const set = await request(app).post(setPath).send(setInput).expect(201);
      const retry = await request(app).post(setPath).send(setInput).expect(200);
      assert.equal(set.body.id,retry.body.id);
      await request(app).post(setPath).send({ ...setInput,reps: 9 }).expect(409);
      await request(app).post(setPath).send({ ...setInput,operation_id: randomUUID() }).expect(409);
      await request(app).patch(`/api/v1/sessions/${session.id}`).send({ status: 'paused' }).expect(200);
      await request(app).post(setPath).send({ ...setInput,position: 2,operation_id: randomUUID() }).expect(409);
      await request(app).patch(`/api/v1/sessions/${session.id}`).send({ status: 'active' }).expect(200);
      const completed = await request(app).patch(`/api/v1/sessions/${session.id}`).send({ status: 'completed' }).expect(200);
      const again = await request(app).patch(`/api/v1/sessions/${session.id}`).send({ status: 'completed' }).expect(200);
      assert.equal(completed.body.completed_at,again.body.completed_at);
      await request(app).post(setPath).send(setInput).expect(200);
      await request(app).patch(`/api/v1/sessions/${session.id}`).send({ status: 'active' }).expect(409);
      const correction = { position: 1,reps: 9,weight_kg: 12,operation_id: randomUUID(),expected_revision: 0,expected_updated_at: set.body.updated_at };
      const corrected = await request(app).put(`/api/v1/sessions/${session.id}/sets/${set.body.id}`).send(correction).expect(200);
      const replay = await request(app).put(`/api/v1/sessions/${session.id}/sets/${set.body.id}`).send(correction).expect(200);
      assert.equal(corrected.body.revision,1);
      assert.equal(replay.body.updated_at,corrected.body.updated_at);
      await request(app).put(`/api/v1/sessions/${session.id}/sets/${set.body.id}`).send({ ...correction,reps: 11 }).expect(409);
      await request(app).put(`/api/v1/sessions/${session.id}/sets/${set.body.id}`).send({ ...correction,operation_id: randomUUID() }).expect(409);
      await request(app).put(`/api/v1/sessions/${session.id}/sets/${set.body.id}`).send({ position: 1,reps: 10,weight_kg: 12 }).expect(200);
      await request(app).put(`/api/v1/workout-templates/${templateId}`).send({ name: 'Changed template',exercises: [{ exercise_id: exerciseId,prescription: 'Changed prescription' }] }).expect(200);
      await request(app).put(`/api/v1/exercises/${exerciseId}`).send({ name: 'Renamed squat',measurement_type: 'reps' }).expect(200);
      const history = await request(app).get(`/api/v1/sessions/${session.id}`).expect(200);
      assert.equal(history.body.template_name,'Starter strength');
      assert.equal(history.body.exercises[0].name,'Goblet squat');
      assert.equal(history.body.exercises[0].measurement_type,'weight_reps');
      assert.equal(history.body.exercises.length,3);
      assert.equal(history.body.exercises[0].sets.length,1);
      assert.equal(history.body.exercises[0].sets[0].reps,10);
      assert.equal((await request(app).get(`/api/v1/exercises/${exerciseId}/history`)).body[0].reps,10);
      assert.equal((await request(app).get('/api/v1/sessions')).body.length,1);
      await run(process.execPath,['--import','tsx','src/db/seed.ts'],{ cwd,env: process.env });
      const templateAfterSeed = await request(app).get(`/api/v1/workout-templates/${templateId}`).expect(200);
      assert.equal(templateAfterSeed.body.name,'Changed template');
      assert.equal(templateAfterSeed.body.exercises.length,1);
    });
    await t.test('duration and distance set types', async () => {
      const s = await request(app).post('/api/v1/sessions').send({ template_id: '20000000-0000-4000-8000-000000000002',operation_id: randomUUID() }).expect(201);
      const path = `/api/v1/sessions/${s.body.id}/exercises/${s.body.exercises[0].id}/sets`;
      await request(app).post(path).send({ operation_id: randomUUID(),position: 1,duration_seconds: 600,distance_meters: 2000 }).expect(201);
      await request(app).post(path).send({ operation_id: randomUUID(),position: 2,duration_seconds: 600 }).expect(400);
      const t = await request(app).post('/api/v1/workout-templates').send({ name: 'Timed workout',exercises: [{ exercise_id: '10000000-0000-4000-8000-000000000003' }] }).expect(201);
      const timed = await request(app).post('/api/v1/sessions').send({ template_id: t.body.id,operation_id: randomUUID() }).expect(201);
      await request(app).post(`/api/v1/sessions/${timed.body.id}/exercises/${timed.body.exercises[0].id}/sets`).send({ operation_id: randomUUID(),position: 1,duration_seconds: 20 }).expect(201);
      const repsTemplate = await request(app).post('/api/v1/workout-templates').send({ name: 'Repetition workout',exercises: [{ exercise_id: '10000000-0000-4000-8000-000000000002' }] }).expect(201);
      const repsSession = await request(app).post('/api/v1/sessions').send({ template_id: repsTemplate.body.id,operation_id: randomUUID() }).expect(201);
      await request(app).post(`/api/v1/sessions/${repsSession.body.id}/exercises/${repsSession.body.exercises[0].id}/sets`).send({ operation_id: randomUUID(),position: 1,reps: 8 }).expect(201);
    });
    await t.test('progress excludes incomplete sessions, handles adherence and correction-aware records', async () => {
      await pool.query("UPDATE workout_sessions SET started_at=now()-interval '500 days'");
      const dates = (await pool.query("SELECT (now() AT TIME ZONE 'UTC')::date::text AS today,((now() AT TIME ZONE 'UTC')::date-1)::text AS yesterday")).rows[0];
      const program = await request(app).post('/api/v1/programs').send({ name: 'Progress fixture',weeks: 1,schedule: [{ template_id: templateId,week: 1,day: 1 },{ template_id: templateId,week: 1,day: 3 }] }).expect(201);
      await request(app).post(`/api/v1/programs/${program.body.id}/activate`).send({ start_date: dates.yesterday }).expect(200);
      async function fixture(status: string,when: string,weight: number,exercise = exerciseId) {
        const s = (await pool.query(`INSERT INTO workout_sessions(template_id,template_name,operation_id,status,started_at,completed_at)
          VALUES($1,'Progress fixture',$2,$3,$4,CASE WHEN $3='completed' THEN now() ELSE NULL END) RETURNING id`,[templateId,randomUUID(),status,when])).rows[0];
        const e = (await pool.query(`INSERT INTO session_exercises(session_id,exercise_id,name,measurement_type,prescription,rest_seconds,position)
          VALUES($1,$2,'Historical squat','weight_reps','Fixture',60,0) RETURNING id`,[s.id,exercise])).rows[0];
        return (await pool.query('INSERT INTO exercise_sets(session_exercise_id,operation_id,position,reps,weight_kg) VALUES($1,$2,1,8,$3) RETURNING *',[e.id,randomUUID(),weight])).rows[0];
      }
      const yesterday = `${dates.yesterday}T12:00:00.000Z`;
      await fixture('completed',yesterday,10);await fixture('completed',yesterday,12);
      const now = (await pool.query('SELECT now()::text AS stamp')).rows[0].stamp;
      await fixture('completed',now,6);await fixture('active',now,999);await fixture('paused',now,888);
      const older = (await pool.query("SELECT (now()-interval '400 days')::text AS stamp")).rows[0].stamp;
      const old = await fixture('completed',older,100);
      const report = await request(app).get('/api/v1/progress?days=30&timezone=UTC').expect(200);
      assert.deepEqual(report.body.summary,{ completed_sessions: 3,training_days: 2,recorded_sets: 3 });
      assert.equal(report.body.weekly_frequency.reduce((sum: number,w: {sessions: number}) => sum+w.sessions,0),3);
      assert.deepEqual(report.body.adherence,{ due_workouts: 1,completed_on_schedule: 1 });
      assert.equal(report.body.next_workout.scheduled_date,(await pool.query("SELECT ($1::date+1)::text AS day",[dates.today])).rows[0].day);
      const record = report.body.records.find((r: {exercise_id: string;measurement_type: string}) => r.exercise_id === exerciseId && r.measurement_type === 'weight_reps');
      assert.equal(record.max_weight_kg,100);
      assert.ok(report.body.trends.every((t: {max_weight_kg: number}) => t.max_weight_kg<=12));
      await pool.query('UPDATE exercise_sets SET weight_kg=4 WHERE id=$1',[old.id]);
      const changed = await request(app).get('/api/v1/progress?days=30&timezone=UTC').expect(200);
      assert.equal(changed.body.records.find((r: {exercise_id: string;measurement_type: string}) => r.exercise_id === exerciseId && r.measurement_type === 'weight_reps').max_weight_kg,12);
      const boundaryExercise = (await request(app).post('/api/v1/exercises').send({ name: 'Timezone fixture',measurement_type: 'weight_reps' }).expect(201)).body.id;
      await fixture('completed',`${dates.yesterday}T00:30:00.000Z`,7,boundaryExercise);
      const chicago = await request(app).get('/api/v1/progress?days=30&timezone=America%2FChicago').expect(200);
      const expected = (await pool.query("SELECT ($1::timestamptz AT TIME ZONE 'America/Chicago')::date::text AS day",[`${dates.yesterday}T00:30:00.000Z`])).rows[0].day;
      assert.equal(chicago.body.trends.find((t: {exercise_id: string}) => t.exercise_id === boundaryExercise).day,expected);
    });
    await t.test('API recovers after a database idle connection is terminated', { timeout: 5000 }, async () => {
      const connection = await pool.connect();
      const pid = (await connection.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      connection.release();
      const lost = new Promise<void>(resolve => pool.once('error',() => resolve()));
      await admin.query('SELECT pg_terminate_backend($1)',[pid]);
      await lost;
      await request(app).get('/api/v1/health').expect(200);
      await request(app).get('/api/v1/health/db').expect(200);
    });
    await t.test('running API smoke command completes a real HTTP workflow', async () => {
      const server = app.listen(0,'127.0.0.1');
      await new Promise<void>((resolve,reject) => { server.once('listening',resolve); server.once('error',reject); });
      try {
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        const smoke = await run(process.execPath,['../scripts/verify-phase2.mjs'],{
          cwd,env: { ...process.env,LIFE_STRONG_API_URL: `http://127.0.0.1:${address.port}/api/v1` },
        });
        assert.match(smoke.stdout,/PASS: program/);
        const offline = await run(process.execPath,['--import','tsx','../frontend/tests/offline-http.mjs'],{
          cwd,env: { ...process.env,EXPO_PUBLIC_API_BASE_URL: `http://127.0.0.1:${address.port}/api/v1` },
        });
        assert.match(offline.stdout,/PASS: offline restart/);
      } finally { await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve())); }
    });
    await t.test('customization targets, retries, stale edits, archives and historical independence', async () => {
      const types = ['reps','weight_reps','duration','distance_duration'];
      const targets = [{ target_sets: 3,target_reps: 8 },{ target_sets: 2,target_reps: 10,target_weight_kg: 0 },{ target_sets: 1,target_duration_seconds: 30 },{ target_sets: 1,target_duration_seconds: 600,target_distance_meters: 2000 }];
      const exercises = [];
      for (const type of types) {
        const body = { name: `Custom ${type}`,equipment: 'Custom',muscle_focus: 'General',measurement_type: type,operation_id: randomUUID() };
        const [a,b] = await Promise.all([request(app).post('/api/v1/exercises').send(body),request(app).post('/api/v1/exercises').send(body)]);
        assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.body.id,b.body.id);
        exercises.push(a.body);
        await request(app).post('/api/v1/exercises').send({ ...body,name: 'Conflicting retry' }).expect(409);
      }
      const body = { name: 'Custom mixed workout',description: 'All measurement types',operation_id: randomUUID(),exercises: exercises.map((e,index) => ({ exercise_id: e.id,prescription: `Instructions ${index}`,rest_seconds: index*10,...targets[index] })) };
      const template = (await request(app).post('/api/v1/workout-templates').send(body).expect(201)).body;
      const replay = (await request(app).post('/api/v1/workout-templates').send(body).expect(201)).body;
      assert.equal(template.id,replay.id);assert.equal(template.exercises[1].target_weight_kg,0);
      await request(app).put(`/api/v1/workout-templates/${template.id}`).send({ ...body,operation_id: randomUUID(),expected_revision: 0,exercises: [{ exercise_id: exercises[0].id,target_duration_seconds: 30 }] }).expect(400);
      assert.equal((await request(app).get(`/api/v1/workout-templates/${template.id}`)).body.revision,0);
      await request(app).put(`/api/v1/workout-templates/${template.id}`).send({ ...body,operation_id: randomUUID(),exercises: [{ exercise_id: exercises[0].id,target_sets: 1.5 }] }).expect(400);
      const started = (await request(app).post('/api/v1/sessions').send({ template_id: template.id,operation_id: randomUUID() }).expect(201)).body;
      assert.equal(started.exercises[0].target_sets,3);assert.deepEqual(started.exercises[0].sets,[]);
      const programBody = { name: 'Custom program',description: '',weeks: 2,operation_id: randomUUID(),schedule: [{ template_id: template.id,week: 2,day: 7 }] };
      const program = (await request(app).post('/api/v1/programs').send(programBody).expect(201)).body;
      assert.equal((await request(app).post('/api/v1/programs').send(programBody).expect(201)).body.id,program.id);
      await request(app).delete(`/api/v1/exercises/${exercises[0].id}`).expect(409);
      await request(app).delete(`/api/v1/workout-templates/${template.id}`).expect(409);
      const exerciseChange = { name: 'Changed custom reps',measurement_type: 'duration',operation_id: randomUUID(),expected_revision: 0 };
      await request(app).put(`/api/v1/exercises/${exercises[0].id}`).send(exerciseChange).expect(409);
      const update = { ...body,operation_id: randomUUID(),expected_revision: 0,name: 'Reordered workout',exercises: [...body.exercises].reverse().slice(0,3) };
      const changed = (await request(app).put(`/api/v1/workout-templates/${template.id}`).send(update).expect(200)).body;
      assert.equal(changed.revision,1);assert.equal(changed.exercises[0].exercise_id,exercises[3].id);
      assert.equal((await request(app).put(`/api/v1/workout-templates/${template.id}`).send(update).expect(200)).body.revision,1);
      await request(app).put(`/api/v1/workout-templates/${template.id}`).send({ ...update,operation_id: randomUUID() }).expect(409);
      await request(app).put(`/api/v1/exercises/${exercises[0].id}`).send(exerciseChange).expect(200);
      await request(app).put(`/api/v1/exercises/${exercises[0].id}`).send({ ...exerciseChange,operation_id: randomUUID() }).expect(409);
      const history = (await request(app).get(`/api/v1/sessions/${started.id}`).expect(200)).body;
      assert.equal(history.template_name,'Custom mixed workout');assert.equal(history.exercises.length,4);
      assert.equal(history.exercises[0].measurement_type,'reps');assert.equal(history.exercises[0].target_reps,8);
      assert.equal(history.exercises[2].target_duration_seconds,30);
      await request(app).post(`/api/v1/sessions/${started.id}/exercises/${history.exercises[0].id}/sets`).send({ operation_id: randomUUID(),position: 1,reps: 6 }).expect(201);
      await request(app).patch(`/api/v1/sessions/${started.id}`).send({ status: 'completed' }).expect(200);
      const completed = (await request(app).get(`/api/v1/sessions/${started.id}`).expect(200)).body;
      assert.equal(completed.exercises[0].target_reps,8);assert.equal(completed.exercises[0].sets[0].reps,6);
      await request(app).put(`/api/v1/programs/${program.id}`).send({ ...programBody,operation_id: randomUUID(),expected_revision: 0,weeks: 3,schedule: [] }).expect(200);
      await request(app).put(`/api/v1/programs/${program.id}`).send({ ...programBody,operation_id: randomUUID(),expected_revision: 0 }).expect(409);
      await request(app).delete(`/api/v1/programs/${program.id}`).send({ expected_revision: 0 }).expect(409);
      await request(app).delete(`/api/v1/programs/${program.id}`).send({ expected_revision: 1 }).expect(204);
      await request(app).delete(`/api/v1/workout-templates/${template.id}`).send({ expected_revision: 1 }).expect(204);
      await request(app).delete(`/api/v1/exercises/${exercises[0].id}`).send({ expected_revision: 1 }).expect(204);
      await request(app).post('/api/v1/sessions').send({ template_id: template.id,operation_id: randomUUID() }).expect(404);
      assert.equal((await request(app).get(`/api/v1/sessions/${started.id}`).expect(200)).body.exercises[0].sets[0].reps,6);
    });
    await t.test('private owner authentication, ownership, expiry, export, revocation and deletion', async () => {
      const priorMode = process.env.AUTH_MODE;
      const priorNode = process.env.NODE_ENV;
      const email = 'owner@example.invalid',password = 'test-only-owner-password-012345';
      await run(process.execPath,['--import','tsx','src/db/owner.ts'],{ cwd,env: { ...process.env,OWNER_EMAIL: email,OWNER_PASSWORD: password } });
      process.env.AUTH_MODE = 'owner';
      try {
        for (const path of ['/exercises','/workout-templates','/programs','/sessions','/progress','/schedule','/health/db','/account/export']) await request(app).get(`/api/v1${path}`).expect(401);
        await request(app).post('/api/v1/exercises').send({ name: 'Unauthorized write' }).expect(401);
        await request(app).get('/api/v1/health').expect(200);
        await request(app).post('/api/v1/auth/login').send({ email,password: 'wrong' }).expect(401);
        const login = async () => (await request(app).post('/api/v1/auth/login').send({ email,password }).expect(200)).body.token as string;
        const token = await login();assert.match(token,/^[a-f0-9]{64}$/);
        const stored = (await pool.query('SELECT token_hash FROM auth_sessions')).rows[0].token_hash;
        assert.notEqual(stored,token);
        const auth = `Bearer ${token}`;
        const me = await request(app).get('/api/v1/account/me').set('Authorization',auth).expect(200);
        assert.equal(me.body.email,email);
        const ownerIds = (await pool.query('SELECT DISTINCT owner_id FROM workout_sessions')).rows;
        assert.ok(ownerIds.every(r => r.owner_id === me.body.id));
        await assert.rejects(pool.query("INSERT INTO app_owner(singleton,id,email) VALUES(false,$1,'intruder@example.invalid')",[randomUUID()]));
        await request(app).get('/api/v1/exercises').set('Authorization',`Bearer ${'0'.repeat(64)}`).expect(401);
        const exported = await request(app).get('/api/v1/account/export').set('Authorization',auth).expect(200);
        assert.ok(Array.isArray(exported.body.workout_sessions));assert.equal(exported.body.owner.email,email);
        assert.equal(exported.body.auth_sessions,undefined);assert.equal(exported.body.password_hash,undefined);
        process.env.NODE_ENV = 'production';
        await request(app).get('/api/v1/exercises').set('Authorization',auth).expect(400);
        process.env.NODE_ENV = priorNode;
        await pool.query("UPDATE auth_sessions SET expires_at=now()-interval '1 minute'");
        await request(app).get('/api/v1/exercises').set('Authorization',auth).expect(401);
        const nextToken = await login();
        await request(app).post('/api/v1/account/logout').set('Authorization',`Bearer ${nextToken}`).send({}).expect(200);
        await request(app).get('/api/v1/account/me').set('Authorization',`Bearer ${nextToken}`).expect(401);
        const rotatedToken = await login();
        await run(process.execPath,['--import','tsx','src/db/owner.ts'],{ cwd,env: { ...process.env,OWNER_EMAIL: email,OWNER_PASSWORD: password } });
        await request(app).get('/api/v1/account/me').set('Authorization',`Bearer ${rotatedToken}`).expect(401);
        const finalToken = await login();
        await request(app).delete('/api/v1/account').set('Authorization',`Bearer ${finalToken}`).send({ confirmation: 'wrong' }).expect(400);
        await request(app).delete('/api/v1/account').set('Authorization',`Bearer ${finalToken}`).send({ confirmation: 'DELETE MY ACCOUNT' }).expect(200);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM workout_sessions')).rows[0].n,0);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM exercises')).rows[0].n,0);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM library_write_receipts')).rows[0].n,0);
        await request(app).get('/api/v1/account/me').set('Authorization',`Bearer ${finalToken}`).expect(401);
        await request(app).post('/api/v1/auth/login').send({ email,password }).expect(503);
      } finally {
        if (priorMode === undefined) delete process.env.AUTH_MODE;else process.env.AUTH_MODE = priorMode;
        if (priorNode === undefined) delete process.env.NODE_ENV;else process.env.NODE_ENV = priorNode;
      }
    });
  } finally {
    await pool.end();
    process.env.DATABASE_URL = original;
    // This schema was created uniquely by this test; application data is untouched.
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});
