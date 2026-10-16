ALTER TABLE exercise_sets ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE set_correction_receipts (
  operation_id UUID PRIMARY KEY,
  set_id UUID NOT NULL REFERENCES exercise_sets(id),
  request JSONB NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
