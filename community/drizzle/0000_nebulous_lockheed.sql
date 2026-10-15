CREATE TABLE `quotas` (
	`bucket` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quota_expiry` ON `quotas` (`expires_at`);--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`client_hash` text NOT NULL,
	`record_hash` text NOT NULL,
	`record_json` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`anonymous` integer NOT NULL,
	`ranked` integer NOT NULL,
	`scope` text NOT NULL,
	`name` text NOT NULL,
	`class_name` text NOT NULL,
	`region` text NOT NULL,
	`server` text NOT NULL,
	`boss` text NOT NULL,
	`difficulty` text NOT NULL,
	`dps` real NOT NULL,
	`damage` integer NOT NULL,
	`duration` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_retry` ON `shares` (`token_hash`,`client_hash`);--> statement-breakpoint
CREATE INDEX `share_expiry` ON `shares` (`expires_at`);--> statement-breakpoint
CREATE INDEX `ranking_dps` ON `shares` (`ranked`,`scope`,`dps`,`id`);--> statement-breakpoint
CREATE INDEX `ranking_region` ON `shares` (`ranked`,`region`,`dps`);--> statement-breakpoint
CREATE INDEX `ranking_boss` ON `shares` (`ranked`,`boss`,`dps`);--> statement-breakpoint
CREATE INDEX `ranking_class` ON `shares` (`ranked`,`class_name`,`dps`);