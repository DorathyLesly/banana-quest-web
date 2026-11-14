CREATE TABLE `game_events` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`username`) REFERENCES `players`(`username`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `players` ADD `coins` integer DEFAULT 0 NOT NULL;