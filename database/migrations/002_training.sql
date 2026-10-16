CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  equipment TEXT NOT NULL DEFAULT '',
  muscle_focus TEXT NOT NULL DEFAULT '',
  measurement_type TEXT NOT NULL CHECK (measurement_type IN ('reps', 'weight_reps', 'duration', 'distance_duration')),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id), position INTEGER NOT NULL CHECK (position >= 0),
  prescription TEXT NOT NULL DEFAULT '', rest_seconds INTEGER NOT NULL DEFAULT 60 CHECK (rest_seconds >= 0),
  UNIQUE (template_id, position)
);
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  weeks INTEGER NOT NULL CHECK (weeks BETWEEN 1 AND 104), archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE program_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES workout_templates(id),
  week INTEGER NOT NULL CHECK (week > 0), day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 7),
  UNIQUE (program_id, week, day)
);
CREATE TABLE user_programs (
  program_id UUID PRIMARY KEY REFERENCES programs(id), start_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_local_program ON user_programs (active) WHERE active;
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workout_templates(id), template_name TEXT NOT NULL,
  operation_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id), name TEXT NOT NULL,
  measurement_type TEXT NOT NULL, prescription TEXT NOT NULL, rest_seconds INTEGER NOT NULL,
  position INTEGER NOT NULL, UNIQUE (session_id, position)
);
CREATE TABLE exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_exercise_id UUID NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL UNIQUE, position INTEGER NOT NULL CHECK (position > 0),
  reps INTEGER CHECK (reps > 0), weight_kg DOUBLE PRECISION CHECK (weight_kg >= 0),
  duration_seconds DOUBLE PRECISION CHECK (duration_seconds > 0), distance_meters DOUBLE PRECISION CHECK (distance_meters > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_exercise_id, position)
);
CREATE INDEX session_exercise_history ON session_exercises (exercise_id, session_id);
CREATE INDEX session_history ON workout_sessions (started_at DESC);
CREATE TABLE seed_history (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
