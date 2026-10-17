import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import type { PoolClient } from 'pg';

export const trainingRouter = Router();
const uuid = z.uuid();
const name = z.string().trim().min(1).max(160);
const text = z.string().trim().max(2000);
const measurement = z.enum(['reps', 'weight_reps', 'duration', 'distance_duration']);
const writeMetadata = { operation_id: uuid.optional(), expected_revision: z.number().int().nonnegative().optional() };
const targets = {
  target_sets: z.number().int().min(1).max(1000).nullable().optional(),
  target_reps: z.number().int().positive().max(100000).nullable().optional(),
  target_weight_kg: z.number().min(0).max(10000).nullable().optional(),
  target_duration_seconds: z.number().positive().max(604800).nullable().optional(),
  target_distance_meters: z.number().positive().max(10000000).nullable().optional(),
};
const targetMetrics = ['target_reps','target_weight_kg','target_duration_seconds','target_distance_meters'] as const;
function compatibleTargets(type: string, value: Record<string,unknown>) {
  const allowed: Record<string,string[]> = { reps: ['target_reps'],weight_reps: ['target_reps','target_weight_kg'],duration: ['target_duration_seconds'],distance_duration: ['target_duration_seconds','target_distance_meters'] };
  return targetMetrics.every(field => value[field] == null || allowed[type]?.includes(field));
}
const exerciseInput = z.object({ name, equipment: text.default(''), muscle_focus: text.default(''), measurement_type: measurement, ...writeMetadata }).strict();
const templateInput = z.object({ name, description: text.default(''), exercises: z.array(z.object({
  exercise_id: uuid, prescription: text.default(''), rest_seconds: z.number().int().min(0).max(3600).default(60), ...targets,
}).strict()).min(1).max(100), ...writeMetadata }).strict();
const programInput = z.object({ name, description: text.default(''), weeks: z.number().int().min(1).max(104), schedule: z.array(z.object({
  template_id: uuid, week: z.number().int().positive(), day: z.number().int().min(1).max(7),
}).strict()).max(728), ...writeMetadata }).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (const item of value.schedule) {
    const key = `${item.week}-${item.day}`;
    if (item.week > value.weeks || seen.has(key)) ctx.addIssue({ code: 'custom', message: 'Schedule must be within program weeks with one workout per day' });
    seen.add(key);
  }
});
const setValues = z.object({ position: z.number().int().min(1).max(1000),
  reps: z.number().int().positive().max(100000).optional(), weight_kg: z.number().min(0).max(10000).optional(),
  duration_seconds: z.number().positive().max(604800).optional(), distance_meters: z.number().positive().max(10000000).optional(),
}).strict();
const newSet = setValues.extend({ operation_id: uuid });
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const fail = (status: number, code: string, message: string): never => { throw new ApiError(status, code, message); };
async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function libraryWrite<T>(key: string, value: { operation_id?: string }, work: (client: PoolClient) => Promise<T>): Promise<T> {
  return transaction(async client => {
    const request = JSON.stringify({ key, value });
    if (value.operation_id) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[value.operation_id]);
      const prior = (await client.query('SELECT response,request=$2::jsonb AS matches FROM library_write_receipts WHERE operation_id=$1',[value.operation_id,request])).rows[0];
      if (prior) {
        if (!prior.matches) fail(409,'OPERATION_CONFLICT','This save identifier was already used with different values.');
        return prior.response;
      }
    }
    const result = await work(client);
    if (value.operation_id) await client.query('INSERT INTO library_write_receipts(operation_id,request,response) VALUES($1,$2,$3)',[value.operation_id,request,JSON.stringify(result)]);
    return result;
  });
}
function checkRevision(row: { revision: number; archived: boolean }, expected?: number) {
  if (row.archived) fail(409,'ARCHIVED','This item is archived. Reload the library.');
  if (expected !== undefined && row.revision !== expected) fail(409,'STALE_EDIT','This item changed elsewhere. Reload it before editing. Your form is retained.');
}
async function requireRow(client: Pick<PoolClient, 'query'>, sql: string, values: unknown[]) {
  const row = (await client.query(sql, values)).rows[0];
  if (!row) fail(404, 'NOT_FOUND', 'Resource not found');
  return row;
}
async function templateDetail(id: string, client: Pick<PoolClient, 'query'> = pool) {
  const row = await requireRow(client, 'SELECT * FROM workout_templates WHERE id=$1', [id]);
  row.exercises = (await client.query(`SELECT t.*, e.name, e.measurement_type FROM template_exercises t
    JOIN exercises e ON e.id=t.exercise_id WHERE template_id=$1 ORDER BY position`, [id])).rows;
  return row;
}
async function programDetail(id: string, client: Pick<PoolClient, 'query'> = pool) {
  const row = await requireRow(client, 'SELECT * FROM programs WHERE id=$1', [id]);
  row.schedule = (await client.query(`SELECT s.*, t.name AS template_name FROM program_schedule s
    JOIN workout_templates t ON t.id=s.template_id WHERE program_id=$1 ORDER BY week,day`, [id])).rows;
  return row;
}
async function sessionDetail(id: string, client: Pick<PoolClient, 'query'> = pool) {
  const row = await requireRow(client, 'SELECT * FROM workout_sessions WHERE id=$1', [id]);
  row.exercises = (await client.query(`SELECT e.*, COALESCE((SELECT json_agg(s ORDER BY s.position)
    FROM exercise_sets s WHERE s.session_exercise_id=e.id),'[]'::json) AS sets
    FROM session_exercises e WHERE session_id=$1 ORDER BY position`, [id])).rows;
  return row;
}

trainingRouter.get('/exercises', async (_req, res) => {
  res.json((await pool.query('SELECT * FROM exercises WHERE NOT archived ORDER BY name')).rows);
});
trainingRouter.get('/exercises/:id', async (req, res) => {
  res.json(await requireRow(pool, 'SELECT * FROM exercises WHERE id=$1', [uuid.parse(req.params.id)]));
});
async function saveExercise(id: string | undefined, v: z.infer<typeof exerciseInput>) {
  return libraryWrite(`exercise:${id ?? 'new'}`,v,async client => {
    if (id) {
      const previous = await requireRow(client,'SELECT * FROM exercises WHERE id=$1 FOR UPDATE',[id]);
      checkRevision(previous,v.expected_revision);
      const linked = (await client.query('SELECT t.* FROM template_exercises t JOIN workout_templates w ON w.id=t.template_id WHERE t.exercise_id=$1 AND NOT w.archived',[id])).rows;
      if (linked.some(row => !compatibleTargets(v.measurement_type,row))) fail(409,'INCOMPATIBLE_TARGETS','Remove incompatible targets from linked workouts before changing this exercise type.');
      return requireRow(client,`UPDATE exercises SET name=$2,equipment=$3,muscle_focus=$4,measurement_type=$5,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`,[id,v.name,v.equipment,v.muscle_focus,v.measurement_type]);
    }
    return (await client.query(`INSERT INTO exercises(name,equipment,muscle_focus,measurement_type) VALUES($1,$2,$3,$4) RETURNING *`,[v.name,v.equipment,v.muscle_focus,v.measurement_type])).rows[0];
  });
}
trainingRouter.post('/exercises', async (req,res) => { res.status(201).json(await saveExercise(undefined,exerciseInput.parse(req.body))); });
trainingRouter.put('/exercises/:id', async (req,res) => { res.json(await saveExercise(uuid.parse(req.params.id),exerciseInput.parse(req.body))); });
trainingRouter.delete('/exercises/:id', async (req,res) => {
  const id = uuid.parse(req.params.id),v = z.object(writeMetadata).strict().parse(req.body ?? {});
  await transaction(async client => {
    const row = await requireRow(client,'SELECT * FROM exercises WHERE id=$1 FOR UPDATE',[id]);
    if (row.archived) return;
    checkRevision(row,v.expected_revision);
    if ((await client.query('SELECT 1 FROM template_exercises t JOIN workout_templates w ON w.id=t.template_id WHERE t.exercise_id=$1 AND NOT w.archived LIMIT 1',[id])).rowCount) fail(409,'IN_USE','Remove this exercise from active library workouts, or archive those workouts first.');
    await client.query('UPDATE exercises SET archived=true,revision=revision+1,updated_at=now() WHERE id=$1',[id]);
  });res.status(204).end();
});
trainingRouter.get('/workout-templates', async (_req, res) => {
  res.json((await pool.query('SELECT * FROM workout_templates WHERE NOT archived ORDER BY name')).rows);
});
trainingRouter.get('/workout-templates/:id', async (req, res) => { res.json(await templateDetail(uuid.parse(req.params.id))); });
async function saveTemplate(id: string | undefined, v: z.infer<typeof templateInput>) {
  return libraryWrite(`template:${id ?? 'new'}`,v,async client => {
    if (id) checkRevision(await requireRow(client,'SELECT * FROM workout_templates WHERE id=$1 FOR UPDATE',[id]),v.expected_revision);
    const row = id ? await requireRow(client, `UPDATE workout_templates SET name=$2,description=$3,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`, [id,v.name,v.description])
      : (await client.query('INSERT INTO workout_templates(name,description) VALUES($1,$2) RETURNING *', [v.name,v.description])).rows[0];
    await client.query('DELETE FROM template_exercises WHERE template_id=$1', [row.id]);
    for (const [position, e] of v.exercises.entries()) {
      const exercise = await requireRow(client, 'SELECT * FROM exercises WHERE id=$1 AND NOT archived FOR SHARE', [e.exercise_id]);
      if (!compatibleTargets(exercise.measurement_type,e)) fail(400,'INCOMPATIBLE_TARGETS','Workout targets must match the exercise measurement type.');
      await client.query(`INSERT INTO template_exercises(template_id,exercise_id,position,prescription,rest_seconds,target_sets,target_reps,target_weight_kg,target_duration_seconds,target_distance_meters)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [row.id,e.exercise_id,position,e.prescription,e.rest_seconds,e.target_sets ?? null,e.target_reps ?? null,e.target_weight_kg ?? null,e.target_duration_seconds ?? null,e.target_distance_meters ?? null]);
    }
    return templateDetail(row.id, client);
  });
}
trainingRouter.post('/workout-templates', async (req, res) => { res.status(201).json(await saveTemplate(undefined,templateInput.parse(req.body))); });
trainingRouter.put('/workout-templates/:id', async (req, res) => { res.json(await saveTemplate(uuid.parse(req.params.id),templateInput.parse(req.body))); });
trainingRouter.delete('/workout-templates/:id', async (req,res) => {
  const id = uuid.parse(req.params.id),v = z.object(writeMetadata).strict().parse(req.body ?? {});
  await transaction(async client => {
    const row = await requireRow(client,'SELECT * FROM workout_templates WHERE id=$1 FOR UPDATE',[id]);
    if (row.archived) return;
    checkRevision(row,v.expected_revision);
    if ((await client.query('SELECT 1 FROM program_schedule s JOIN programs p ON p.id=s.program_id WHERE s.template_id=$1 AND NOT p.archived LIMIT 1',[id])).rowCount) fail(409,'IN_USE','Remove this workout from library programs, or archive those programs first.');
    await client.query('UPDATE workout_templates SET archived=true,revision=revision+1,updated_at=now() WHERE id=$1',[id]);
  });res.status(204).end();
});
trainingRouter.get('/programs', async (_req, res) => { res.json((await pool.query('SELECT * FROM programs WHERE NOT archived ORDER BY name')).rows); });
trainingRouter.get('/programs/:id', async (req, res) => { res.json(await programDetail(uuid.parse(req.params.id))); });
async function saveProgram(id: string | undefined, v: z.infer<typeof programInput>) {
  return libraryWrite(`program:${id ?? 'new'}`,v,async client => {
    if (id) checkRevision(await requireRow(client,'SELECT * FROM programs WHERE id=$1 FOR UPDATE',[id]),v.expected_revision);
    const row = id ? await requireRow(client, 'UPDATE programs SET name=$2,description=$3,weeks=$4,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *', [id,v.name,v.description,v.weeks])
      : (await client.query('INSERT INTO programs(name,description,weeks) VALUES($1,$2,$3) RETURNING *', [v.name,v.description,v.weeks])).rows[0];
    await client.query('DELETE FROM program_schedule WHERE program_id=$1', [row.id]);
    for (const s of v.schedule) {
      await requireRow(client, 'SELECT id FROM workout_templates WHERE id=$1 AND NOT archived FOR SHARE', [s.template_id]);
      await client.query('INSERT INTO program_schedule(program_id,template_id,week,day) VALUES($1,$2,$3,$4)', [row.id,s.template_id,s.week,s.day]);
    }
    return programDetail(row.id, client);
  });
}
trainingRouter.post('/programs', async (req, res) => { res.status(201).json(await saveProgram(undefined,programInput.parse(req.body))); });
trainingRouter.put('/programs/:id', async (req, res) => { res.json(await saveProgram(uuid.parse(req.params.id),programInput.parse(req.body))); });
trainingRouter.delete('/programs/:id', async (req, res) => {
  await transaction(async client => {
    const id = uuid.parse(req.params.id),v = z.object(writeMetadata).strict().parse(req.body ?? {});
    const row = await requireRow(client,'SELECT * FROM programs WHERE id=$1 FOR UPDATE',[id]);
    if (!row.archived) { checkRevision(row,v.expected_revision); await client.query('UPDATE programs SET archived=true,revision=revision+1,updated_at=now() WHERE id=$1',[id]); }
    await client.query('UPDATE user_programs SET active=false,updated_at=now() WHERE program_id=$1', [req.params.id]);
  }); res.status(204).end();
});
trainingRouter.post('/programs/:id/activate', async (req, res) => {
  const id = uuid.parse(req.params.id), v = z.object({ start_date: z.iso.date() }).strict().parse(req.body);
  res.json(await transaction(async client => {
    // Serialize activation for the local single-user profile.
    await client.query('LOCK TABLE user_programs IN EXCLUSIVE MODE');
    await requireRow(client, 'SELECT id FROM programs WHERE id=$1 AND NOT archived FOR SHARE', [id]);
    await client.query('UPDATE user_programs SET active=false,updated_at=now() WHERE active');
    return (await client.query(`INSERT INTO user_programs(program_id,start_date) VALUES($1,$2)
      ON CONFLICT(program_id) DO UPDATE SET start_date=$2,active=true,updated_at=now() RETURNING *`, [id,v.start_date])).rows[0];
  }));
});
trainingRouter.get('/schedule', async (_req, res) => {
  res.json((await pool.query(`SELECT s.*, t.name AS template_name,
    u.start_date + ((s.week-1)*7+s.day-1) AS scheduled_date FROM user_programs u
    JOIN program_schedule s ON s.program_id=u.program_id JOIN workout_templates t ON t.id=s.template_id
    WHERE u.active ORDER BY s.week,s.day`)).rows);
});
trainingRouter.get('/sessions', async (_req, res) => {
  res.json((await pool.query('SELECT * FROM workout_sessions ORDER BY started_at DESC LIMIT 200')).rows);
});
trainingRouter.get('/sessions/:id', async (req, res) => { res.json(await sessionDetail(uuid.parse(req.params.id))); });
trainingRouter.post('/sessions', async (req, res) => {
  const v = z.object({ template_id: uuid, operation_id: uuid }).strict().parse(req.body);
  const result = await transaction(async client => {
    // Same operation ID serializes retries, including concurrent ones.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [v.operation_id]);
    const prior = (await client.query('SELECT * FROM workout_sessions WHERE operation_id=$1', [v.operation_id])).rows[0];
    if (prior) {
      if (prior.template_id !== v.template_id) fail(409,'OPERATION_CONFLICT','Operation ID already used for another template');
      return { created: false, session: await sessionDetail(prior.id,client) };
    }
    await requireRow(client, 'SELECT id FROM workout_templates WHERE id=$1 AND NOT archived FOR SHARE', [v.template_id]);
    await client.query('SELECT e.id FROM exercises e JOIN template_exercises t ON t.exercise_id=e.id WHERE t.template_id=$1 ORDER BY e.id FOR SHARE OF e',[v.template_id]);
    const template = await templateDetail(v.template_id,client);
    if (!template.exercises.length) fail(409,'EMPTY_TEMPLATE','Template has no exercises');
    const session = (await client.query(`INSERT INTO workout_sessions(template_id,template_name,operation_id) VALUES($1,$2,$3) RETURNING *`, [v.template_id,template.name,v.operation_id])).rows[0];
    await client.query(`INSERT INTO session_exercises(session_id,exercise_id,name,measurement_type,prescription,rest_seconds,position,target_sets,target_reps,target_weight_kg,target_duration_seconds,target_distance_meters)
      SELECT $1,t.exercise_id,e.name,e.measurement_type,t.prescription,t.rest_seconds,t.position,t.target_sets,t.target_reps,t.target_weight_kg,t.target_duration_seconds,t.target_distance_meters
      FROM template_exercises t JOIN exercises e ON e.id=t.exercise_id WHERE t.template_id=$2`, [session.id,v.template_id]);
    return { created: true, session: await sessionDetail(session.id,client) };
  });
  res.status(result.created ? 201 : 200).json(result.session);
});
trainingRouter.patch('/sessions/:id', async (req, res) => {
  const id = uuid.parse(req.params.id), v = z.object({ status: z.enum(['active','paused','completed']) }).strict().parse(req.body);
  res.json(await transaction(async client => {
    const row = await requireRow(client, 'SELECT * FROM workout_sessions WHERE id=$1 FOR UPDATE', [id]);
    if (row.status === 'completed' && v.status !== 'completed') fail(409,'SESSION_COMPLETED','Completed sessions cannot be reopened');
    if (v.status === 'completed') {
      const count = (await client.query(`SELECT count(*)::int AS n FROM exercise_sets s JOIN session_exercises e ON e.id=s.session_exercise_id WHERE e.session_id=$1`, [id])).rows[0].n;
      if (!count) fail(409,'EMPTY_SESSION','Log at least one set before completing');
    }
    await client.query(`UPDATE workout_sessions SET status=$2,completed_at=CASE WHEN $2='completed' THEN COALESCE(completed_at,now()) ELSE NULL END,updated_at=now() WHERE id=$1`, [id,v.status]);
    return sessionDetail(id,client);
  }));
});
function validateValues(type: string, v: z.infer<typeof setValues>) {
  const allowed: Record<string,string[]> = { reps: ['reps'], weight_reps: ['reps','weight_kg'], duration: ['duration_seconds'], distance_duration: ['duration_seconds','distance_meters'] };
  const fields = allowed[type] ?? [];
  const metrics = ['reps','weight_kg','duration_seconds','distance_meters'] as const;
  if (fields.some(f => v[f as typeof metrics[number]] === undefined) || metrics.some(f => v[f] !== undefined && !fields.includes(f))) {
    fail(400,'MEASUREMENT_MISMATCH',`Expected values: ${fields.join(', ')}`);
  }
}
trainingRouter.post('/sessions/:id/exercises/:exerciseId/sets', async (req, res) => {
  const id = uuid.parse(req.params.id), exerciseId = uuid.parse(req.params.exerciseId), v = newSet.parse(req.body);
  const result = await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [v.operation_id]);
    const session = await requireRow(client,'SELECT * FROM workout_sessions WHERE id=$1 FOR UPDATE',[id]);
    const e = await requireRow(client,'SELECT * FROM session_exercises WHERE id=$1 AND session_id=$2',[exerciseId,id]);
    validateValues(e.measurement_type,v);
    const prior = (await client.query('SELECT * FROM exercise_sets WHERE operation_id=$1',[v.operation_id])).rows[0];
    if (prior) {
      if (prior.session_exercise_id !== exerciseId || prior.position !== v.position ||
        ['reps','weight_kg','duration_seconds','distance_meters'].some(k => (prior[k] ?? null) !== (v[k as keyof typeof v] ?? null))) fail(409,'OPERATION_CONFLICT','Operation ID already used with different set values');
      return { created: false, set: prior };
    }
    if (session.status !== 'active') fail(409,'SESSION_NOT_ACTIVE','Resume the session before adding sets');
    const set = (await client.query(`INSERT INTO exercise_sets(session_exercise_id,operation_id,position,reps,weight_kg,duration_seconds,distance_meters)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[exerciseId,v.operation_id,v.position,v.reps ?? null,v.weight_kg ?? null,v.duration_seconds ?? null,v.distance_meters ?? null])).rows[0];
    return { created: true, set };
  }); res.status(result.created ? 201 : 200).json(result.set);
});
trainingRouter.put('/sessions/:id/sets/:setId', async (req,res) => {
  const id = uuid.parse(req.params.id), setId = uuid.parse(req.params.setId);
  const v = setValues.extend({ operation_id: uuid.optional(), expected_updated_at: z.iso.datetime().optional(),expected_revision: z.number().int().nonnegative().optional() }).parse(req.body);
  res.json(await transaction(async client => {
    if (v.operation_id) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[v.operation_id]);
      const previous = (await client.query('SELECT *, request=$2::jsonb AS matches FROM set_correction_receipts WHERE operation_id=$1',[v.operation_id,JSON.stringify({ ...v,session_id: id,set_id: setId })])).rows[0];
      if (previous) {
        if (!previous.matches) fail(409,'OPERATION_CONFLICT','Correction operation already used with different values');
        return previous.response;
      }
    }
    await requireRow(client,'SELECT id FROM workout_sessions WHERE id=$1 FOR UPDATE',[id]);
    const e = await requireRow(client,`SELECT e.measurement_type,s.updated_at,s.revision FROM exercise_sets s JOIN session_exercises e ON e.id=s.session_exercise_id WHERE s.id=$1 AND e.session_id=$2 FOR UPDATE OF s`,[setId,id]);
    validateValues(e.measurement_type,v);
    if (v.expected_updated_at && new Date(v.expected_updated_at).getTime() !== e.updated_at.getTime()) fail(409,'STALE_CORRECTION','This set changed elsewhere. Review server data before correcting it.');
    if (v.expected_revision !== undefined && v.expected_revision !== e.revision) fail(409,'STALE_CORRECTION','This set changed elsewhere. Review server data before correcting it.');
    const result = (await client.query(`UPDATE exercise_sets SET position=$2,reps=$3,weight_kg=$4,duration_seconds=$5,distance_meters=$6,updated_at=now(),revision=revision+1 WHERE id=$1 RETURNING *`,[setId,v.position,v.reps ?? null,v.weight_kg ?? null,v.duration_seconds ?? null,v.distance_meters ?? null])).rows[0];
    if (v.operation_id) await client.query('INSERT INTO set_correction_receipts(operation_id,set_id,request,response) VALUES($1,$2,$3,$4)',[v.operation_id,setId,JSON.stringify({ ...v,session_id: id,set_id: setId }),JSON.stringify(result)]);
    return result;
  }));
});
trainingRouter.get('/exercises/:id/history', async (req,res) => {
  const id = uuid.parse(req.params.id);
  await requireRow(pool,'SELECT id FROM exercises WHERE id=$1',[id]);
  res.json((await pool.query(`SELECT s.*,w.started_at,w.completed_at,w.status FROM exercise_sets s
    JOIN session_exercises e ON e.id=s.session_exercise_id JOIN workout_sessions w ON w.id=e.session_id
    WHERE e.exercise_id=$1 ORDER BY w.started_at DESC,s.position LIMIT 500`,[id])).rows);
});
