-- user_roles: 1 rows
INSERT INTO "user_roles" ("created_at", "id", "role", "user_id") VALUES
  ('2025-12-22T23:56:12.572039+00:00', 'dd0e639b-4a2a-4fae-83fe-0780061d2bc7', 'admin', '49703cde-8442-4a0a-8b0b-aeb6391e429d')
ON CONFLICT (id) DO NOTHING;

