CREATE TABLE `elective_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`curriculum_id` integer NOT NULL,
	`trail` text NOT NULL,
	`position` integer NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`credits` real NOT NULL,
	FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `elective_options_curriculum_code_idx` ON `elective_options` (`curriculum_id`,`code`);--> statement-breakpoint
CREATE INDEX `elective_options_code_idx` ON `elective_options` (`code`);--> statement-breakpoint
ALTER TABLE `curricula` ADD `elective_rule` text;--> statement-breakpoint
CREATE INDEX `courses_code_idx` ON `courses` (`code`);