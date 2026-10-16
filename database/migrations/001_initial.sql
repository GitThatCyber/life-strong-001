-- Phase 1 establishes migration infrastructure only.
-- Feature tables are intentionally deferred to Phase 2.
CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO app_metadata (key, value) VALUES ('schema_version', 'phase_1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
