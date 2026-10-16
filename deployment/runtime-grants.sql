REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO lifestrong_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lifestrong_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lifestrong_app;
REVOKE ALL ON app_owner FROM lifestrong_app;
GRANT SELECT ON app_owner TO lifestrong_app;
GRANT UPDATE (email,password_hash,disabled,updated_at) ON app_owner TO lifestrong_app;
REVOKE ALL ON schema_migrations FROM lifestrong_app;
GRANT SELECT ON schema_migrations TO lifestrong_app;
