CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`course_code` text NOT NULL,
	`grade` text NOT NULL,
	`term_year` integer,
	`term_season` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_user_idx` ON `attempts` (`user_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`curriculum_id` integer NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`credits` real NOT NULL,
	`category` text NOT NULL,
	`non_credit` integer DEFAULT false NOT NULL,
	`semester` integer,
	`alternatives` text NOT NULL,
	`prereq` text,
	FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_curriculum_code_idx` ON `courses` (`curriculum_id`,`code`);--> statement-breakpoint
CREATE INDEX `courses_curriculum_idx` ON `courses` (`curriculum_id`);--> statement-breakpoint
CREATE TABLE `curricula` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_code` text NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`effective_from_year` integer NOT NULL,
	`total_credits` real NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `curricula_program_version_idx` ON `curricula` (`program_code`,`version`);--> statement-breakpoint
CREATE TABLE `student_courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`credits` real NOT NULL,
	`category` text NOT NULL,
	`excluded` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_courses_user_code_idx` ON `student_courses` (`user_id`,`code`);