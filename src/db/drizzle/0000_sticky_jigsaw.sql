CREATE TABLE `buildings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`save_id` integer NOT NULL,
	`grid_x` integer NOT NULL,
	`grid_y` integer NOT NULL,
	`type` text NOT NULL,
	`powered` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`save_id`) REFERENCES `saves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chronology` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`save_id` integer NOT NULL,
	`year` integer DEFAULT 1980 NOT NULL,
	`month` integer DEFAULT 1 NOT NULL,
	`tick` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`save_id`) REFERENCES `saves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`save_id` integer NOT NULL,
	`type` text DEFAULT 'food' NOT NULL,
	`target` integer DEFAULT 500 NOT NULL,
	`current` integer DEFAULT 0 NOT NULL,
	`deadline_year` integer DEFAULT 1985 NOT NULL,
	FOREIGN KEY (`save_id`) REFERENCES `saves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`save_id` integer NOT NULL,
	`money` integer DEFAULT 2000 NOT NULL,
	`food` integer DEFAULT 200 NOT NULL,
	`vodka` integer DEFAULT 50 NOT NULL,
	`power` integer DEFAULT 0 NOT NULL,
	`power_used` integer DEFAULT 0 NOT NULL,
	`population` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`save_id`) REFERENCES `saves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `saves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text DEFAULT 'autosave' NOT NULL,
	`timestamp` integer NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL,
	`game_state` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
