import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = (process.env.LIFE_STRONG_API_URL ?? 'http://127.0.0.1:3000/api/v1').replace(/\/$/,'');
async function call(path, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}
try {
  await call('/health/db');
  const programs = await call('/programs');
  assert.ok(programs.length, 'Run npm run db:seed first');
  const program = await call(`/programs/${programs[0].id}`);
  assert.ok(program.schedule.length, 'Program needs a scheduled workout');
  const template = await call(`/workout-templates/${program.schedule[0].template_id}`);
  const input = { template_id: template.id,operation_id: randomUUID() };
  const session = await call('/sessions','POST',input,201);
  assert.equal((await call('/sessions','POST',input)).id,session.id);
  const exercise = session.exercises[0];
  assert.ok(exercise, 'Template needs an exercise');
  const examples = {
    reps: { reps: 8 },weight_reps: { reps: 8,weight_kg: 12 },
    duration: { duration_seconds: 20 },distance_duration: { duration_seconds: 600,distance_meters: 2000 },
  };
  const metrics = examples[exercise.measurement_type];
  assert.ok(metrics, 'Unsupported measurement type');
  const setInput = { position: 1,operation_id: randomUUID(),...metrics };
  const setPath = `/sessions/${session.id}/exercises/${exercise.id}/sets`;
  const set = await call(setPath,'POST',setInput,201);
  assert.equal((await call(setPath,'POST',setInput)).id,set.id);
  await call(`/sessions/${session.id}`,'PATCH',{ status: 'paused' });
  await call(`/sessions/${session.id}`,'PATCH',{ status: 'active' });
  await call(`/sessions/${session.id}`,'PATCH',{ status: 'completed' });
  const saved = await call(`/sessions/${session.id}`);
  assert.equal(saved.status,'completed');
  assert.equal(saved.exercises[0].sets.length,1);
  assert.equal(saved.exercises[0].sets[0].id,set.id);
  assert.ok((await call(`/exercises/${exercise.exercise_id}/history`)).some(s => s.id === set.id));
  console.log(`PASS: program → template → session → set → completion → history\nSession: ${session.id}\nThis is a real development session with illustrative test values; one session is added per run.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error('Check that PostgreSQL and the API are running and migrations/seeds are applied. A failed run may leave a partial development session.');
  process.exitCode = 1;
}
