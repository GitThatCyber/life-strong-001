-- Existing prose prescriptions remain unchanged; optional targets are not inferred.
ALTER TABLE exercises ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE workout_templates ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE programs ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE template_exercises
  ADD COLUMN target_sets INTEGER CHECK (target_sets BETWEEN 1 AND 1000),
  ADD COLUMN target_reps INTEGER CHECK (target_reps BETWEEN 1 AND 100000),
  ADD COLUMN target_weight_kg DOUBLE PRECISION CHECK (target_weight_kg BETWEEN 0 AND 10000),
  ADD COLUMN target_duration_seconds DOUBLE PRECISION CHECK (target_duration_seconds > 0 AND target_duration_seconds <= 604800),
  ADD COLUMN target_distance_meters DOUBLE PRECISION CHECK (target_distance_meters > 0 AND target_distance_meters <= 10000000);
ALTER TABLE session_exercises
  ADD COLUMN target_sets INTEGER,
  ADD COLUMN target_reps INTEGER,
  ADD COLUMN target_weight_kg DOUBLE PRECISION,
  ADD COLUMN target_duration_seconds DOUBLE PRECISION,
  ADD COLUMN target_distance_meters DOUBLE PRECISION;
-- Replay library writes exactly, including after a response is lost or a later edit occurs.
CREATE TABLE library_write_receipts (
  operation_id UUID PRIMARY KEY,
  request JSONB NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
