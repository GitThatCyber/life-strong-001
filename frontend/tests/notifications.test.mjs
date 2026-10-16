import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notificationPlans } from '../features/notifications/planner.ts';
const p = { reminders: true,rest: true,hour: 18,minute: 15,days: [2,4,6,2] };
const workout = status => ({ server: { status },timer: { deadline: 61000,paused: null,finished: false },queue: [] });
test('notification plan repeats selected local weekdays once and schedules only active future rest', () => {
  const plans = notificationPlans(p,{ active: workout('active'),paused: workout('paused'),completed: workout('completed') },1000);
  assert.deepEqual(plans.filter(p => p.kind === 'weekly').map(p => [p.weekday,p.hour,p.minute]),[[2,18,15],[4,18,15],[6,18,15]]);
  assert.equal(plans.filter(p => p.kind === 'rest').length,1);
  assert.equal(plans.at(-1).deadline,61000);
  assert.equal(notificationPlans(p,{ old: workout('active') },62000).filter(p => p.kind === 'rest').length,0);
});
test('disable, pause, completion and skipped rest remove planned alerts, including queued offline status', () => {
  assert.equal(notificationPlans({ ...p,reminders: false,rest: false },{ active: workout('active') },1000).length,0);
  for (const status of ['paused','completed']) {
    const w = workout('active');w.queue = [{ kind: 'status',status }];
    assert.equal(notificationPlans({ ...p,reminders: false },{ queued: w },1000).length,0);
  }
  const w = workout('active');w.timer.deadline = null;
  assert.equal(notificationPlans({ ...p,reminders: false },{ skipped: w },1000).length,0);
});
