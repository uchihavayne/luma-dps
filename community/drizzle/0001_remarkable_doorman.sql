CREATE TABLE `team_peers` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`class_name` text NOT NULL,
	`received_at` integer NOT NULL,
	`sequence` integer NOT NULL,
	`capture_live` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_peer_token` ON `team_peers` (`room_id`,`token_hash`);--> statement-breakpoint
CREATE INDEX `team_active_peers` ON `team_peers` (`room_id`,`received_at`);--> statement-breakpoint
CREATE TABLE `team_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`join_hash` text NOT NULL,
	`host_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_host` ON `team_rooms` (`host_hash`);--> statement-breakpoint
CREATE INDEX `team_expiry` ON `team_rooms` (`expires_at`);