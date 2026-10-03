-- BanMeaw Trainee schema. Runs idempotently on the first authenticated API request.
BEGIN;
-- Rename the first-version tables to clearer names (no-op once renamed).
ALTER TABLE IF EXISTS app_users RENAME TO members;
ALTER TABLE IF EXISTS diary_entries RENAME TO daily_logs;
ALTER INDEX IF EXISTS diary_entries_user_day RENAME TO daily_logs_member_day;
-- Unused draft of trainer mapping, replaced by trainer_teams/team_members.
DROP TABLE IF EXISTS trainer_trainees;

-- members: everyone who signed in (display name, public ID BM-XXXXXX, role).
CREATE TABLE IF NOT EXISTS members (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'trainer', 'trainee')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- The member's sex, used as the default 3D figure (null = not set).
ALTER TABLE members ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('male', 'female'));
ALTER TABLE members ADD COLUMN IF NOT EXISTS member_code text NOT NULL UNIQUE DEFAULT ('BM-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)));

-- daily_logs: meal and workout entries per member and day (kind = meal | workout).
CREATE TABLE IF NOT EXISTS daily_logs (
  user_id text NOT NULL REFERENCES members(id),
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 100),
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('meal', 'workout')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS daily_logs_member_day ON daily_logs(user_id, day DESC);

-- trainer_teams: teams created by a trainer (owner_id).
CREATE TABLE IF NOT EXISTS trainer_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES members(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trainer_teams_owner ON trainer_teams(owner_id);
-- The owner's own role inside the team (the owner always keeps management rights).
ALTER TABLE trainer_teams ADD COLUMN IF NOT EXISTS owner_role text NOT NULL DEFAULT 'trainer' CHECK (owner_role IN ('trainer', 'trainee'));

-- team_members: people in a team (team_role trainer | trainee); status invited until they accept, then active.
CREATE TABLE IF NOT EXISTS team_members (
  team_id uuid NOT NULL REFERENCES trainer_teams(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES members(id),
  status text NOT NULL CHECK (status IN ('invited', 'active')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS team_members_member ON team_members(user_id);
-- Role inside the team, set by the team owner.
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS team_role text NOT NULL DEFAULT 'trainee' CHECK (team_role IN ('trainer', 'trainee'));

-- body_measurements: weight, girths and InBody-style segmental fat/muscle per member and day.
CREATE TABLE IF NOT EXISTS body_measurements (
  user_id text NOT NULL REFERENCES members(id),
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 100),
  day date NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS body_measurements_member_day ON body_measurements(user_id, day DESC);

-- daily_reports: a member marked that day's food log as sent to their trainers.
CREATE TABLE IF NOT EXISTS daily_reports (
  user_id text NOT NULL REFERENCES members(id),
  day date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
COMMIT;
