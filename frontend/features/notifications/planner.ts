import type { LocalWorkout } from '../offline/engine';
import { projected } from '../offline/engine';
export type Preferences = { reminders: boolean; rest: boolean; hour: number; minute: number; days: number[] };
export type Plan = { id: string; title: string; body: string } & ({ kind: 'weekly'; weekday: number; hour: number; minute: number } | { kind: 'rest'; deadline: number; sessionId: string });
export function notificationPlans(p: Preferences,workouts: Record<string,LocalWorkout>,now: number): Plan[] {
  const plans: Plan[] = [];
  if (p.reminders) for (const weekday of new Set(p.days)) plans.push({ id: `life-strong.workout.${weekday}`,kind: 'weekly',weekday,hour: p.hour,minute: p.minute,title: 'Time to train',body: 'Open Life Strong and choose your next workout.' });
  if (p.rest) for (const [id,w] of Object.entries(workouts)) if (w.timer.deadline !== null && w.timer.deadline > now && projected(w).status === 'active') plans.push({
    id: `life-strong.rest.${id}`,kind: 'rest',deadline: w.timer.deadline,sessionId: id,title: 'Rest complete',body: 'Ready for your next set?',
  });
  return plans;
}
