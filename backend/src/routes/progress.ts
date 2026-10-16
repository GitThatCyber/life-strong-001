import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
export const progressRouter = Router();
const query = z.object({
  days: z.enum(['30','90','365']).default('30').transform(Number),
  timezone: z.string().min(1).max(100).default('UTC').refine(value => {
    try { new Intl.DateTimeFormat('en',{ timeZone: value });return true; } catch { return false; }
  },'Unknown timezone'),
}).strict();
progressRouter.get('/',async (req,res) => {
  const { days,timezone } = query.parse(req.query);
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const bounds = (await client.query(`SELECT (now() AT TIME ZONE $1)::date::text AS today,
      ((now() AT TIME ZONE $1)::date-($2::int-1))::text AS from_date`,[timezone,days])).rows[0];
    const values = [timezone,bounds.from_date,bounds.today];
    const filter = `w.status='completed' AND (w.started_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date AND w.started_at<=now()`;
    const summary = (await client.query(`SELECT count(*)::int AS completed_sessions,
      count(DISTINCT (w.started_at AT TIME ZONE $1)::date)::int AS training_days,
      COALESCE(sum((SELECT count(*) FROM exercise_sets s JOIN session_exercises e ON e.id=s.session_exercise_id WHERE e.session_id=w.id)),0)::int AS recorded_sets
      FROM workout_sessions w WHERE ${filter}`,values)).rows[0];
    const frequency = (await client.query(`WITH weeks AS (
      SELECT generate_series(date_trunc('week',$2::date::timestamp),date_trunc('week',$3::date::timestamp),'1 week')::date AS week
    ) SELECT weeks.week::text AS week_start,count(w.id)::int AS sessions,
      (weeks.week<$2::date OR weeks.week+6>$3::date) AS partial_week
      FROM weeks LEFT JOIN workout_sessions w ON date_trunc('week',w.started_at AT TIME ZONE $1)::date=weeks.week
        AND ${filter} GROUP BY weeks.week ORDER BY weeks.week`,values)).rows;
    const records = (await client.query(`SELECT e.exercise_id,e.measurement_type,
      (array_agg(e.name ORDER BY w.started_at DESC,e.position))[1] AS name,
      max(s.reps) AS max_reps,max(s.weight_kg) AS max_weight_kg,max(s.duration_seconds) AS max_duration_seconds,
      max(s.distance_meters) AS max_distance_meters,count(*)::int AS recorded_sets
      FROM exercise_sets s JOIN session_exercises e ON e.id=s.session_exercise_id JOIN workout_sessions w ON w.id=e.session_id
      WHERE w.status='completed' AND w.started_at<=now()
      GROUP BY e.exercise_id,e.measurement_type ORDER BY name,e.measurement_type`)).rows;
    const trends = (await client.query(`SELECT e.exercise_id,e.measurement_type,(w.started_at AT TIME ZONE $1)::date::text AS day,
      max(s.reps) AS max_reps,max(s.weight_kg) AS max_weight_kg,max(s.duration_seconds) AS max_duration_seconds,
      max(s.distance_meters) AS max_distance_meters,count(*)::int AS recorded_sets
      FROM exercise_sets s JOIN session_exercises e ON e.id=s.session_exercise_id JOIN workout_sessions w ON w.id=e.session_id
      WHERE ${filter} GROUP BY e.exercise_id,e.measurement_type,(w.started_at AT TIME ZONE $1)::date ORDER BY day`,values)).rows;
    const recent = (await client.query(`SELECT w.* FROM workout_sessions w WHERE ${filter} ORDER BY w.started_at DESC LIMIT 20`,values)).rows;
    const active = (await client.query(`SELECT p.id,p.name,u.start_date::text AS start_date FROM user_programs u JOIN programs p ON p.id=u.program_id WHERE u.active AND NOT p.archived`)).rows[0] ?? null;
    let adherence = null, nextWorkout = null;
    if (active) {
      adherence = (await client.query(`WITH slots AS (
        SELECT s.*,u.start_date+((s.week-1)*7+s.day-1) AS scheduled_date
        FROM program_schedule s JOIN user_programs u ON u.program_id=s.program_id WHERE u.active
      ) SELECT count(*)::int AS due_workouts,
        count(*) FILTER(WHERE EXISTS(SELECT 1 FROM workout_sessions w WHERE w.template_id=slots.template_id AND w.status='completed'
          AND (w.started_at AT TIME ZONE $1)::date=slots.scheduled_date AND w.started_at<=now()))::int AS completed_on_schedule
        FROM slots WHERE scheduled_date BETWEEN $2::date AND $3::date`,values)).rows[0];
      nextWorkout = (await client.query(`SELECT s.template_id,t.name,u.start_date+((s.week-1)*7+s.day-1) AS date_value,
        (u.start_date+((s.week-1)*7+s.day-1))::text AS scheduled_date
        FROM program_schedule s JOIN user_programs u ON u.program_id=s.program_id JOIN workout_templates t ON t.id=s.template_id
        WHERE u.active AND NOT t.archived AND u.start_date+((s.week-1)*7+s.day-1)>=$1::date
        AND NOT EXISTS(SELECT 1 FROM workout_sessions w WHERE w.template_id=s.template_id AND w.status='completed'
          AND (w.started_at AT TIME ZONE $2)::date=u.start_date+((s.week-1)*7+s.day-1) AND w.started_at<=now())
        ORDER BY date_value LIMIT 1`,[bounds.today,timezone])).rows[0] ?? null;
      if (nextWorkout) delete nextWorkout.date_value;
    }
    await client.query('COMMIT');
    res.json({ generated_at: new Date().toISOString(),timezone,days,...bounds,summary,weekly_frequency: frequency,records,trends,recent_sessions: recent,active_program: active,adherence,next_workout: nextWorkout });
  } catch (error) { await client.query('ROLLBACK');throw error; }
  finally { client.release(); }
});
