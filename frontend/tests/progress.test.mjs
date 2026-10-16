import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adherenceText, localDate, metricText } from '../features/progress/model.ts';
test('progress labels do not invent percentage for a zero denominator or lose zero load', () => {
  assert.equal(adherenceText(null),'No scheduled workouts due in this window');
  assert.equal(adherenceText({ due_workouts: 0,completed_on_schedule: 0 }),'No scheduled workouts due in this window');
  assert.equal(adherenceText({ due_workouts: 3,completed_on_schedule: 2 }),'2 of 3 completed on schedule (67%)');
  assert.equal(metricText({ max_reps: 8,max_weight_kg: 0,max_duration_seconds: null,max_distance_meters: null }),'8 reps · 0 kg');
  assert.equal(localDate(new Date(2026,0,2,23,59)),'2026-01-02');
});
