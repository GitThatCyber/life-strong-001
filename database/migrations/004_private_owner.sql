-- The release target is one private owner, not public registration/multi-tenancy.
CREATE TABLE app_owner (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  id UUID NOT NULL UNIQUE DEFAULT '40000000-0000-4000-8000-000000000001',
  email TEXT UNIQUE, password_hash TEXT, disabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO app_owner(singleton) VALUES(true);
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES app_owner(id),
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_expiry ON auth_sessions(expires_at);
ALTER TABLE exercises ADD COLUMN owner_id UUID NOT NULL DEFAULT '40000000-0000-4000-8000-000000000001' REFERENCES app_owner(id);
ALTER TABLE workout_templates ADD COLUMN owner_id UUID NOT NULL DEFAULT '40000000-0000-4000-8000-000000000001' REFERENCES app_owner(id);
ALTER TABLE programs ADD COLUMN owner_id UUID NOT NULL DEFAULT '40000000-0000-4000-8000-000000000001' REFERENCES app_owner(id);
ALTER TABLE workout_sessions ADD COLUMN owner_id UUID NOT NULL DEFAULT '40000000-0000-4000-8000-000000000001' REFERENCES app_owner(id);
ALTER TABLE user_programs ADD COLUMN owner_id UUID NOT NULL DEFAULT '40000000-0000-4000-8000-000000000001' REFERENCES app_owner(id);
-- All descendants belong to their parent. The singleton owner prevents a second
-- profile from being provisioned; multi-user support requires a new design/gate.
