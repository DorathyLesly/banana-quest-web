CREATE TABLE `players` (
	`username` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`best` integer DEFAULT 0 NOT NULL,
	`games` integer DEFAULT 0 NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`expires` integer NOT NULL,
	`game` text,
	`revision` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`username`) REFERENCES `players`(`username`) ON UPDATE no action ON DELETE no action
);
