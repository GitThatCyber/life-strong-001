export type Measurement = 'reps' | 'weight_reps' | 'duration' | 'distance_duration';
export type Metric = 'reps' | 'weight_kg' | 'duration_seconds' | 'distance_meters';
export type SetValues = { position: number } & Partial<Record<Metric,number>>;
export type WorkoutSet = SetValues & { id: string; operation_id: string; updated_at: string; revision?: number };
export type SessionExercise = {
  id: string; exercise_id: string; name: string; measurement_type: Measurement;
  prescription: string; rest_seconds: number; position: number; sets: WorkoutSet[];
};
export type Session = {
  id: string; template_name: string; status: 'active' | 'paused' | 'completed';
  started_at: string; completed_at: string | null; exercises: SessionExercise[];
};
export type SessionSummary = Omit<Session,'exercises'>;
export type Draft = Record<Metric,string>;
export const emptyDraft = (): Draft => ({ reps: '',weight_kg: '',duration_seconds: '',distance_meters: '' });
export const metricFields: Record<Measurement,Metric[]> = {
  reps: ['reps'],weight_reps: ['reps','weight_kg'],duration: ['duration_seconds'],distance_duration: ['distance_meters','duration_seconds'],
};
export const labels: Record<Metric,string> = { reps: 'Repetitions',weight_kg: 'Load (kg)',duration_seconds: 'Duration (seconds)',distance_meters: 'Distance (meters)' };
const max: Record<Metric,number> = { reps: 100000,weight_kg: 10000,duration_seconds: 604800,distance_meters: 10000000 };
export function parseSet(type: Measurement, draft: Draft, position: number): SetValues {
  if (!Number.isInteger(position) || position < 1 || position > 1000) throw new Error('A workout exercise can have at most 1,000 sets.');
  const result: SetValues = { position };
  for (const field of metricFields[type]) {
    const input = draft[field].trim().replace(',','.');
    const value = Number(input);
    if (!/^\d+(\.\d+)?$/.test(input) || !Number.isFinite(value) || value > max[field] ||
      (field === 'weight_kg' ? value < 0 : value <= 0) || (field === 'reps' && !Number.isInteger(value))) {
      throw new Error(`${labels[field]} must be ${field === 'weight_kg' ? 'zero or greater' : field === 'reps' ? 'a positive whole number' : 'greater than zero'}, up to ${max[field].toLocaleString()}.`);
    }
    result[field] = value;
  }
  return result;
}
export function nextPosition(sets: WorkoutSet[]) { return Math.max(0,...sets.map(s => s.position)) + 1; }
export function draftFromSet(set: WorkoutSet): Draft {
  const draft = emptyDraft();
  for (const field of Object.keys(draft) as Metric[]) if (set[field] != null) draft[field] = String(set[field]);
  return draft;
}
export function describeSet(set: SetValues): string {
  return [set.reps != null ? `${set.reps} reps` : '',set.weight_kg != null ? `${set.weight_kg} kg` : '',
    set.duration_seconds != null ? `${set.duration_seconds} sec` : '',set.distance_meters != null ? `${set.distance_meters} m` : ''].filter(Boolean).join(' · ');
}
export function applySet(session: Session,exerciseId: string,set: WorkoutSet): Session {
  return { ...session,exercises: session.exercises.map(e => e.id !== exerciseId ? e : {
    ...e,sets: [...e.sets.filter(s => s.id !== set.id && s.operation_id !== set.operation_id),set].sort((a,b) => a.position-b.position),
  }) };
}
export function restRemaining(deadline: number | null,now: number) {
  return deadline === null ? 0 : Math.max(0,Math.ceil((deadline-now)/1000));
}
