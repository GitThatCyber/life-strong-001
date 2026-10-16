import type { SessionSummary } from '../workouts/model';
export type Metrics = { max_reps: number | null; max_weight_kg: number | null; max_duration_seconds: number | null; max_distance_meters: number | null };
export type RecordRow = Metrics & { exercise_id: string; measurement_type: string; name: string; recorded_sets: number };
export type Trend = Metrics & { exercise_id: string; measurement_type: string; day: string; recorded_sets: number };
export type Progress = {
  generated_at: string; timezone: string; days: number; today: string; from_date: string;
  summary: { completed_sessions: number; training_days: number; recorded_sets: number };
  weekly_frequency: { week_start: string; sessions: number; partial_week: boolean }[];
  records: RecordRow[]; trends: Trend[]; recent_sessions: SessionSummary[];
  active_program: { id: string; name: string; start_date: string } | null;
  adherence: { due_workouts: number; completed_on_schedule: number } | null;
  next_workout: { template_id: string; name: string; scheduled_date: string } | null;
};
export function metricText(row: Metrics) {
  return [row.max_reps === null ? '' : `${row.max_reps} reps`,row.max_weight_kg === null ? '' : `${row.max_weight_kg} kg`,
    row.max_duration_seconds === null ? '' : `${row.max_duration_seconds} sec`,row.max_distance_meters === null ? '' : `${row.max_distance_meters} m`].filter(Boolean).join(' · ');
}
export function adherenceText(value: Progress['adherence']) {
  return !value || !value.due_workouts ? 'No scheduled workouts due in this window' : `${value.completed_on_schedule} of ${value.due_workouts} completed on schedule (${Math.round(value.completed_on_schedule/value.due_workouts*100)}%)`;
}
export const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
