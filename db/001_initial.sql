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

ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar text;

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
CREATE TABLE IF NOT EXISTS training_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES trainer_teams(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 day date NOT NULL,
 exercises jsonb NOT NULL,
 created_by text NOT NULL REFERENCES members(id),
 batch_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_plans_user_day ON training_plans(user_id,day);

CREATE TABLE IF NOT EXISTS trainer_feedback (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES trainer_teams(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES members(id),
 day date NOT NULL,
 author_id text NOT NULL REFERENCES members(id),
 text text NOT NULL CHECK (length(text)<=2000),
 reviewed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trainer_feedback_team_day ON trainer_feedback(team_id,user_id,day);

CREATE TABLE IF NOT EXISTS nutrition_targets (
 team_id uuid NOT NULL REFERENCES trainer_teams(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 calories numeric NOT NULL CHECK (calories > 0 AND calories <= 20000),
 protein numeric NOT NULL CHECK (protein > 0 AND protein <= 1000),
 updated_by text NOT NULL REFERENCES members(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (team_id,user_id)
);

CREATE TABLE IF NOT EXISTS team_point_wallets (
 team_id uuid NOT NULL REFERENCES trainer_teams(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES members(id),
 balance integer NOT NULL DEFAULT 0 CHECK (balance>=0),
 earned integer NOT NULL DEFAULT 0 CHECK (earned>=0),
 PRIMARY KEY (team_id,user_id)
);
CREATE TABLE IF NOT EXISTS team_point_awards (
 team_id uuid NOT NULL REFERENCES trainer_teams(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES members(id),
 day date NOT NULL,
 points integer NOT NULL CHECK (points BETWEEN 1 AND 20),
 rest_day boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (team_id,user_id,day)
);
CREATE TABLE IF NOT EXISTS team_rewards (
 team_id uuid NOT NULL REFERENCES trainer_teams(id) ON DELETE CASCADE,
 code text NOT NULL CHECK (code IN ('bbq','shabu','drink')),
 cost integer NOT NULL CHECK (cost BETWEEN 1 AND 100000),
 enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY (team_id,code)
);
CREATE TABLE IF NOT EXISTS team_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES trainer_teams(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES members(id),
 reward text NOT NULL CHECK (reward IN ('bbq','shabu','drink')),
 cost integer NOT NULL CHECK (cost>0),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','rejected','cancelled')),
 resolved_by text REFERENCES members(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 request_id uuid NOT NULL,
 UNIQUE (team_id,user_id,request_id)
);
CREATE INDEX IF NOT EXISTS team_redemptions_team ON team_redemptions(team_id,created_at DESC);

ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS team_visible boolean NOT NULL DEFAULT false;
