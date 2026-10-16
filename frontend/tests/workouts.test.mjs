import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applySet, draftFromSet, emptyDraft, nextPosition, parseSet, restRemaining } from '../features/workouts/model.ts';

test('set entry uses measurement-specific values and canonical units', () => {
  const draft = { ...emptyDraft(),reps: '8',weight_kg: '12,5',duration_seconds: '30',distance_meters: '2000' };
  assert.deepEqual(parseSet('reps',draft,1),{ position: 1,reps: 8 });
  assert.deepEqual(parseSet('weight_reps',draft,1),{ position: 1,reps: 8,weight_kg: 12.5 });
  assert.deepEqual(parseSet('duration',draft,2),{ position: 2,duration_seconds: 30 });
  assert.deepEqual(parseSet('distance_duration',draft,3),{ position: 3,duration_seconds: 30,distance_meters: 2000 });
  assert.deepEqual(parseSet('weight_reps',{ ...draft,weight_kg: '0' },1),{ position: 1,reps: 8,weight_kg: 0 });
});
test('invalid or incomplete input cannot become a zero-valued or fractional rep set', () => {
  for (const reps of ['', ' ', '0', '-1', '1.5', 'NaN', 'Infinity', '1e2', '100001']) {
    assert.throws(() => parseSet('reps',{ ...emptyDraft(),reps },1));
  }
  assert.throws(() => parseSet('duration',{ ...emptyDraft(),duration_seconds: '0' },1));
  assert.throws(() => parseSet('weight_reps',{ ...emptyDraft(),reps: '8' },1));
  assert.throws(() => parseSet('distance_duration',{ ...emptyDraft(),duration_seconds: '30' },1));
  assert.throws(() => parseSet('reps',{ ...emptyDraft(),reps: '8' },1001));
});
test('retry/correction upserts retain one set and leave other exercise snapshots untouched', () => {
  const first = { id: 'set-1',operation_id: 'op-1',position: 1,reps: 8,weight_kg: 12,updated_at: 'before' };
  const session = { id: 'session',template_name: 'Original',status: 'active',started_at: '',completed_at: null,
    exercises: [
      { id: 'e1',exercise_id: 'library-1',name: 'Original squat',measurement_type: 'weight_reps',prescription: 'Original',rest_seconds: 60,position: 0,sets: [first] },
      { id: 'e2',exercise_id: 'library-2',name: 'Plank',measurement_type: 'duration',prescription: 'Original',rest_seconds: 60,position: 1,sets: [] },
    ] };
  const retry = applySet(session,'e1',first);
  assert.equal(retry.exercises[0].sets.length,1);
  const corrected = applySet(retry,'e1',{ ...first,reps: 10,updated_at: 'after' });
  assert.equal(corrected.exercises[0].sets[0].reps,10);
  assert.equal(session.exercises[0].sets[0].reps,8);
  assert.equal(corrected.exercises[1],session.exercises[1]);
  assert.equal(corrected.exercises[0].name,'Original squat');
  assert.equal(nextPosition([first,{ ...first,id: 'set-3',position: 3 }]),4);
  assert.deepEqual(draftFromSet(first),{ reps: '8',weight_kg: '12',duration_seconds: '',distance_meters: '' });
});
test('rest countdown follows elapsed wall time after delayed/background ticks', () => {
  assert.equal(restRemaining(null,1000),0);
  assert.equal(restRemaining(61000,1000),60);
  assert.equal(restRemaining(61000,40500),21);
  assert.equal(restRemaining(61000,90000),0);
});
