CREATE TABLE `resource_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`course_code` text,
	`faculty_id` integer,
	`note` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`moderation_category` text,
	`moderation_flags` text,
	`moderation_confidence` real,
	`moderation_model` text,
	`moderation_appealed_at` integer,
	`expires_at` integer NOT NULL,
	`fulfilled_at` integer,
	`accepted_submission_id` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` integer,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`faculty_id`) REFERENCES `faculty`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "resource_requests_status_check" CHECK("resource_requests"."status" in ('published', 'pending_review', 'rejected')),
	CONSTRAINT "resource_requests_target_check" CHECK("resource_requests"."course_code" is not null or "resource_requests"."faculty_id" is not null)
);
--> statement-breakpoint
CREATE INDEX `resource_requests_status_id_idx` ON `resource_requests` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `resource_requests_author_idx` ON `resource_requests` (`author_id`,`id`);--> statement-breakpoint
CREATE INDEX `resource_requests_expires_idx` ON `resource_requests` (`expires_at`);--> statement-breakpoint
CREATE INDEX `resource_requests_fulfilled_idx` ON `resource_requests` (`fulfilled_at`);--> statement-breakpoint
CREATE TABLE `resource_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`url` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`moderation_category` text,
	`moderation_flags` text,
	`moderation_confidence` real,
	`moderation_model` text,
	`moderation_appealed_at` integer,
	`rejected_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` integer,
	FOREIGN KEY (`request_id`) REFERENCES `resource_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "resource_submissions_status_check" CHECK("resource_submissions"."status" in ('published', 'pending_review', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `resource_submissions_status_id_idx` ON `resource_submissions` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `resource_submissions_request_idx` ON `resource_submissions` (`request_id`,`id`);--> statement-breakpoint
CREATE INDEX `resource_submissions_author_idx` ON `resource_submissions` (`author_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `attempts_course_faculty_idx` ON `attempts` (`course_code`,`faculty_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `attempts_faculty_course_idx` ON `attempts` (`faculty_id`,`course_code`,`user_id`);