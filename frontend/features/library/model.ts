import { metricFields, type Measurement, type Metric } from '../workouts/model';
export type Targets = { target_sets?: number | null } & Partial<Record<`target_${Metric}`,number | null>>;
export type Exercise = { id: string; name: string; equipment: string; muscle_focus: string; measurement_type: Measurement; revision: number; archived: boolean };
export type TemplateEntry = Targets & { exercise_id: string; name: string; measurement_type: Measurement; prescription: string; rest_seconds: number };
export type Template = { id: string; name: string; description: string; revision: number; archived: boolean; exercises: TemplateEntry[] };
export type Program = { id: string; name: string; description: string; weeks: number; revision: number; archived: boolean; schedule: { template_id: string; template_name: string; week: number; day: number }[] };
export const measurementNames: Record<Measurement,string> = { reps: 'Repetitions',weight_reps: 'Weight and repetitions',duration: 'Duration',distance_duration: 'Distance and duration' };
export const targetNames = { target_sets: 'Target sets',target_reps: 'Target repetitions',target_weight_kg: 'Target load (kg)',target_duration_seconds: 'Target duration per set (seconds)',target_distance_meters: 'Target distance per set (meters)' };
export type TargetKey = keyof typeof targetNames;
export type EntryDraft = { key: string; exercise_id: string; name: string; measurement_type: Measurement; prescription: string; rest_seconds: string } & Record<TargetKey,string>;
export type SlotDraft = { key: string; template_id: string; template_name: string; week: string; day: string };
export function numberInput(input: string,label: string,min: number,max: number,whole = false) {
  const text = input.trim().replace(',','.');
  const value = Number(text);
  if (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(value) || value<min || value>max || (whole && !Number.isInteger(value))) throw new Error(`${label} must be ${whole ? 'a whole number ' : ''}from ${min} to ${max}.`);
  return value;
}
export function entryDraft(entry: TemplateEntry,key: string): EntryDraft {
  return { key,exercise_id: entry.exercise_id,name: entry.name,measurement_type: entry.measurement_type,prescription: entry.prescription,rest_seconds: String(entry.rest_seconds),
    target_sets: entry.target_sets == null ? '' : String(entry.target_sets),target_reps: entry.target_reps == null ? '' : String(entry.target_reps),target_weight_kg: entry.target_weight_kg == null ? '' : String(entry.target_weight_kg),target_duration_seconds: entry.target_duration_seconds == null ? '' : String(entry.target_duration_seconds),target_distance_meters: entry.target_distance_meters == null ? '' : String(entry.target_distance_meters) };
}
export function targetKeys(type: Measurement): TargetKey[] { return ['target_sets',...metricFields[type].map(m => `target_${m}` as TargetKey)]; }
export function entryPayload(entry: EntryDraft) {
  const result: Targets & { exercise_id: string; prescription: string; rest_seconds: number } = { exercise_id: entry.exercise_id,prescription: entry.prescription.trim(),rest_seconds: numberInput(entry.rest_seconds,'Rest seconds',0,3600,true) };
  const allowed = targetKeys(entry.measurement_type);
  for (const key of Object.keys(targetNames) as TargetKey[]) {
    const raw = entry[key].trim();
    if (raw && !allowed.includes(key)) throw new Error(`${entry.name}: targets do not match the exercise type.`);
    const max = key === 'target_sets' ? 1000 : key === 'target_reps' ? 100000 : key === 'target_weight_kg' ? 10000 : key === 'target_duration_seconds' ? 604800 : 10000000;
    result[key] = raw ? numberInput(raw,targetNames[key],key === 'target_weight_kg' ? 0 : key === 'target_sets' || key === 'target_reps' ? 1 : 0.001,max,key === 'target_sets' || key === 'target_reps') : null;
  }
  return result;
}
export function schedulePayload(slots: SlotDraft[],weeks: number) {
  const seen = new Set<string>();
  return slots.map(slot => {
    const week = numberInput(slot.week,'Week',1,weeks,true),day = numberInput(slot.day,'Day',1,7,true),key = `${week}:${day}`;
    if (seen.has(key)) throw new Error('Each week/day can have one workout. Remove the duplicate slot.');
    seen.add(key);return { template_id: slot.template_id,week,day };
  });
}
export function moveEntry<T>(items: T[],index: number,direction: -1 | 1): T[] {
  const to = index+direction;if (to<0 || to>=items.length) return items;
  const result = [...items];[result[index],result[to]] = [result[to],result[index]];return result;
}
export function describeTargets(value: Targets) {
  const parts = [value.target_sets != null ? `${value.target_sets} sets` : '',value.target_reps != null ? `${value.target_reps} reps/set` : '',value.target_weight_kg != null ? `${value.target_weight_kg} kg` : '',value.target_duration_seconds != null ? `${value.target_duration_seconds} sec/set` : '',value.target_distance_meters != null ? `${value.target_distance_meters} m/set` : ''];
  return parts.filter(Boolean).join(' · ') || 'No structured targets';
}
