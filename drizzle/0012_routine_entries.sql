CREATE TABLE `routine_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`term_year` integer NOT NULL,
	`term_season` text NOT NULL,
	`course_code` text NOT NULL,
	`section` integer NOT NULL,
	`days` text NOT NULL,
	`start_minutes` integer NOT NULL,
	`end_minutes` integer NOT NULL,
	`room` text DEFAULT '' NOT NULL,
	`faculty_initials` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "routine_entries_times_check" CHECK("routine_entries"."end_minutes" > "routine_entries"."start_minutes")
);
--> statement-breakpoint
CREATE INDEX `routine_entries_user_term_idx` ON `routine_entries` (`user_id`,`term_year`,`term_season`);