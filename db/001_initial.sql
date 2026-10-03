-- Initial schema. Apply through a controlled migration after authentication is configured.
BEGIN;
CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'trainer', 'trainee')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trainer_trainees (
  trainer_id text NOT NULL REFERENCES app_users(id),
  trainee_id text NOT NULL REFERENCES app_users(id),
  PRIMARY KEY (trainer_id, trainee_id),
  CHECK (trainer_id <> trainee_id)
);
CREATE TABLE IF NOT EXISTS diary_entries (
  user_id text NOT NULL REFERENCES app_users(id),
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 100),
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('meal', 'workout')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
-- Public member ID (e.g. BM-3F9A0C) used to invite trainees into a trainer's team.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS member_code text NOT NULL UNIQUE DEFAULT ('BM-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)));
CREATE INDEX IF NOT EXISTS diary_entries_user_day ON diary_entries(user_id, day DESC);
COMMIT;
