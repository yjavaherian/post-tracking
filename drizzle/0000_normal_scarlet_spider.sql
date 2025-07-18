CREATE TABLE IF NOT EXISTS `deliveries` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tracking_number` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `deliveries_tracking_number_unique` ON `deliveries` (`tracking_number`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`delivery_id` integer NOT NULL,
	`event_date` text NOT NULL,
	`event_time` text NOT NULL,
	`step_number` integer NOT NULL,
	`description` text NOT NULL,
	`location` text,
	FOREIGN KEY (`delivery_id`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
