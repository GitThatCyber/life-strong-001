import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OfflineEngine, projected, emptyTimer } from '../features/offline/engine.ts';
import { emptyDraft } from '../features/workouts/model.ts';
const form = () => ({ index: 0,draft: emptyDraft(),dirty: false });
const base = () => ({ id: 's1',template_name: 'Strength',status: 'active',started_at: '',completed_at: null,exercises: [
  { id: 'e1',exercise_id: 'library',name: 'Squat',measurement_type: 'weight_reps',prescription: 'Original',rest_seconds: 60,position: 0,sets: [] },
] });
const storage = () => { let json = null; return { read: () => json,write: value => { json = value; } }; };
const added = () => ({ id: 'q1',kind: 'set',exerciseId: 'e1',operationId: 'original-op',values: { position: 1,reps: 8,weight_kg: 12 } });
const serverSet = { id: 'server-set',operation_id: 'original-op',position: 1,reps: 8,weight_kg: 12,updated_at: '2026-10-16T12:00:00.000Z' };
test('force-restart recovers form, exercise, timer and exact lost-response request', async () => {
  const disk = storage(); let delivered;
  const first = new OfflineEngine(disk,async (_p,_m,body) => { delivered = body; throw new TypeError('Response lost'); });
  first.cache(base(),form());
  first.update('s1',w => ({ ...w,form: { ...w.form,draft: { ...emptyDraft(),reps: '8',weight_kg: '12' },dirty: true },timer: { deadline: 123456,paused: null,finished: false } }));
  first.enqueue('s1',added()); await first.sync('s1');
  let replay;
  const restored = new OfflineEngine(disk,async (_p,_m,body) => { replay = body; return serverSet; });
  assert.equal(restored.getSnapshot().workouts.s1.form.draft.reps,'8');
  assert.equal(restored.getSnapshot().workouts.s1.timer.deadline,123456);
  await restored.sync('s1');
  assert.deepEqual(replay,delivered);
  assert.equal(restored.getSnapshot().workouts.s1.queue.length,0);
  assert.equal(projected(restored.getSnapshot().workouts.s1).exercises[0].sets.length,1);
});
test('offline FIFO supports create, correction, pause/resume, completion and preserves concurrent typing', async () => {
  const disk = storage(); let engine;
  const calls = [];
  engine = new OfflineEngine(disk,async (path,method,body) => {
    calls.push({ path,method,body });
    engine.update('s1',w => ({ ...w,form: { ...w.form,draft: { ...emptyDraft(),reps: '99' },dirty: true } }));
    if (method === 'POST') return serverSet;
    if (method === 'PUT') return { ...serverSet,reps: 10,updated_at: '2026-10-16T12:01:00.000Z' };
    return { ...base(),status: body.status,exercises: [{ ...base().exercises[0],sets: [{ ...serverSet,reps: 10 }] }] };
  });
  engine.cache(base(),form());engine.enqueue('s1',added());
  engine.enqueue('s1',{ id: 'q2',kind: 'correction',exerciseId: 'e1',operationId: 'original-op',values: { position: 1,reps: 10,weight_kg: 12 } });
  for (const [i,status] of ['paused','active','completed'].entries()) engine.enqueue('s1',{ id: `status-${i}`,kind: 'status',status });
  assert.equal(projected(engine.getSnapshot().workouts.s1).status,'completed');
  assert.equal(projected(engine.getSnapshot().workouts.s1).exercises[0].sets[0].reps,10);
  await Promise.all([engine.sync('s1'),engine.sync('s1')]);
  assert.equal(calls.length,5);
  assert.equal(calls[1].path,'/sessions/s1/sets/server-set');
  assert.equal(calls[1].body.expected_updated_at,serverSet.updated_at);
  assert.equal(engine.getSnapshot().workouts.s1.form.draft.reps,'99');
});
test('correction conflict blocks later writes and retains local data across restart', async () => {
  const disk = storage();let calls = 0;
  const engine = new OfflineEngine(disk,async () => { calls++; throw Object.assign(new Error('Changed elsewhere'),{ status: 409 }); });
  engine.cache({ ...base(),exercises: [{ ...base().exercises[0],sets: [serverSet] }] },form());
  engine.enqueue('s1',{ id: 'correction',kind: 'correction',exerciseId: 'e1',operationId: 'original-op',values: { position: 1,reps: 10,weight_kg: 12 } });
  engine.enqueue('s1',{ id: 'done',kind: 'status',status: 'completed' });
  await engine.sync('s1'); await engine.sync('s1');
  assert.equal(calls,1);assert.equal(engine.getSnapshot().workouts.s1.queue.length,2);
  const restored = new OfflineEngine(disk,async () => base());
  assert.equal(restored.getSnapshot().workouts.s1.blocked,true);
  assert.equal(projected(restored.getSnapshot().workouts.s1).exercises[0].sets[0].reps,10);
  await restored.discardQueue('s1');
  assert.equal(restored.getSnapshot().workouts.s1.queue.length,0);
});
test('storage failure never acknowledges a recorded write or begins network transmission', () => {
  let sends = 0, fail = false;
  const engine = new OfflineEngine({ read: () => null,write: () => { if (fail) throw new Error('Disk full'); } },async () => { sends++;return serverSet; });
  engine.cache(base(),form());fail = true;
  assert.throws(() => engine.enqueue('s1',added()),/Disk full/);
  assert.equal(engine.getSnapshot().workouts.s1.queue.length,0);assert.equal(sends,0);
});
test('start operation IDs persist and refresh never erases queued data', () => {
  const disk = storage();const engine = new OfflineEngine(disk,async () => base());
  assert.equal(engine.startOperation('template',() => 'same-start'),'same-start');
  const restored = new OfflineEngine(disk,async () => base());
  assert.equal(restored.startOperation('template',() => 'different'),'same-start');
  restored.cache(base(),form());restored.enqueue('s1',added());restored.cache(base(),form());
  assert.equal(restored.getSnapshot().workouts.s1.queue.length,1);
  assert.deepEqual(emptyTimer(),{ deadline: null,paused: null,finished: false });
});
