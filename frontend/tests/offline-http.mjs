import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OfflineEngine, projected } from '../features/offline/engine.ts';
import { emptyDraft } from '../features/workouts/model.ts';
import { apiRequest } from '../services/api.ts';
const template = await apiRequest('/workout-templates/20000000-0000-4000-8000-000000000001');
const session = await apiRequest('/sessions','POST',{ template_id: template.id,operation_id: randomUUID() });
const e = session.exercises[0];
const metrics = { reps: { reps: 8 },weight_reps: { reps: 8,weight_kg: 12 },duration: { duration_seconds: 20 },distance_duration: { duration_seconds: 600,distance_meters: 2000 } }[e.measurement_type];
let disk = null,connected = false,loseCorrectionResponse = true;
const storage = { read: () => disk,write: data => { disk = data; } };
const send = async (path,method,body) => {
  if (!connected) throw new Error('Offline');
  const result = await apiRequest(path,method,body);
  if (method === 'PUT' && loseCorrectionResponse) { loseCorrectionResponse = false;throw new Error('Response lost after committed correction'); }
  return result;
};
let engine = new OfflineEngine(storage,send);
engine.cache(session,{ index: 0,draft: emptyDraft(),dirty: false });
const op = randomUUID();
engine.enqueue(session.id,{ id: randomUUID(),kind: 'set',exerciseId: e.id,operationId: op,values: { position: 1,...metrics } });
engine.enqueue(session.id,{ id: randomUUID(),kind: 'correction',exerciseId: e.id,operationId: op,values: { position: 1,...metrics,...('reps' in metrics ? { reps: 10 } : { duration_seconds: 30 }) } });
engine.enqueue(session.id,{ id: randomUUID(),kind: 'status',status: 'completed' });
await engine.sync(session.id);assert.equal(engine.getSnapshot().workouts[session.id].queue.length,3);
engine = new OfflineEngine(storage,send);connected = true;
await engine.sync(session.id); // create acknowledged, correction committed but response lost
assert.equal(engine.getSnapshot().workouts[session.id].queue.length,2);
const captured = engine.getSnapshot().workouts[session.id].queue[0].request;
engine = new OfflineEngine(storage,send);await engine.sync(session.id);
assert.equal(engine.getSnapshot().workouts[session.id].queue.length,0);
const saved = await apiRequest(`/sessions/${session.id}`);
assert.equal(saved.status,'completed');assert.equal(saved.exercises[0].sets.length,1);
assert.equal(saved.exercises[0].sets[0].revision,1);
assert.equal(projected(engine.getSnapshot().workouts[session.id]).exercises[0].sets.length,1);
assert.ok(captured.body.expected_revision === 0);
console.log('PASS: offline restart, correction receipt replay, single set, and queued completion');
