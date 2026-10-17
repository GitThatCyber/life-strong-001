import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entryDraft,entryPayload,describeTargets,moveEntry,schedulePayload } from '../features/library/model.ts';
test('library targets retain zero load, reject incompatible metrics, and stay separate from actual sets',() => {
  const draft = entryDraft({ exercise_id: 'e',name: 'Squat',measurement_type: 'weight_reps',prescription: 'Comfortable effort',rest_seconds: 0,target_sets: 3,target_reps: 8,target_weight_kg: 0 },'key');
  const payload = entryPayload(draft);
  assert.equal(payload.target_weight_kg,0);assert.equal(payload.rest_seconds,0);
  assert.equal(payload.target_duration_seconds,null);assert.equal(payload.sets,undefined);
  assert.match(describeTargets(payload),/3 sets.*8 reps\/set.*0 kg/);
  assert.throws(() => entryPayload({ ...draft,target_duration_seconds: '30' }),/do not match/);
  assert.throws(() => entryPayload({ ...draft,target_sets: '1.5' }),/whole number/);
  assert.throws(() => entryPayload({ ...draft,target_reps: '0' }),/from 1/);
  assert.throws(() => entryPayload({ ...draft,target_weight_kg: '-1' }),/from 0/);
  assert.throws(() => entryPayload({ ...draft,rest_seconds: '' }),/Rest/);
  const timed = entryPayload(entryDraft({ exercise_id: 't',name: 'Plank',measurement_type: 'duration',prescription: '',rest_seconds: 10,target_duration_seconds: 45 },'t'));
  assert.equal(timed.target_duration_seconds,45);assert.equal(timed.target_reps,null);
  assert.equal(describeTargets({}),'No structured targets');
});
test('workout order and program scheduling preserve selection and reject duplicate or invalid days',() => {
  const entries = ['squat','plank','ride'];
  assert.deepEqual(moveEntry(entries,1,-1),['plank','squat','ride']);assert.deepEqual(entries,['squat','plank','ride']);
  assert.deepEqual(moveEntry(entries,0,-1),entries);
  const slot = { key: 'one',template_id: 'workout',template_name: 'Custom',week: '2',day: '7' };
  assert.deepEqual(schedulePayload([slot],2),[{ template_id: 'workout',week: 2,day: 7 }]);
  assert.throws(() => schedulePayload([slot,{ ...slot,key: 'two' }],2),/one workout/);
  assert.throws(() => schedulePayload([slot],1),/Week/);
  assert.throws(() => schedulePayload([{ ...slot,day: '8' }],2),/Day/);
});
