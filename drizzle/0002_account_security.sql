ALTER TABLE players ADD COLUMN email text;
--> statement-breakpoint
ALTER TABLE players ADD COLUMN oauth_provider text;
--> statement-breakpoint
ALTER TABLE players ADD COLUMN oauth_id text;
--> statement-breakpoint
ALTER TABLE players ADD COLUMN avatar text;
--> statement-breakpoint
ALTER TABLE players ADD COLUMN mfa_secret text;
--> statement-breakpoint
ALTER TABLE players ADD COLUMN mfa_enabled integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE players ADD COLUMN mfa_backup_codes text;
--> statement-breakpoint
ALTER TABLE players ADD COLUMN mfa_last_step integer NOT NULL DEFAULT -1;
--> statement-breakpoint
CREATE UNIQUE INDEX players_provider_identity ON players(oauth_provider,oauth_id);
--> statement-breakpoint
CREATE TABLE oauth_states(token text PRIMARY KEY NOT NULL,state text NOT NULL,provider text NOT NULL,expires integer NOT NULL,verifier text NOT NULL);
--> statement-breakpoint
CREATE TABLE auth_challenges(token text PRIMARY KEY NOT NULL,username text NOT NULL REFERENCES players(username),expires integer NOT NULL,attempts integer NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE mfa_setups(token text PRIMARY KEY NOT NULL,username text NOT NULL REFERENCES players(username),secret text NOT NULL,expires integer NOT NULL,attempts integer NOT NULL DEFAULT 0);
--> statement-breakpoint
