CREATE TABLE `faculty` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`initials` text NOT NULL,
	`designation` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `faculty_name_idx` ON `faculty` (`name`);--> statement-breakpoint
ALTER TABLE `attempts` ADD `faculty_id` integer REFERENCES faculty(id) ON DELETE set null;