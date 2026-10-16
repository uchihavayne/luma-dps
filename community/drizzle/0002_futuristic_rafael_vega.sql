ALTER TABLE `shares` ADD `visibility` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `shares` ADD `view_hash` text;--> statement-breakpoint
ALTER TABLE `shares` ADD `combat_power` integer;