CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reporter_id` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_by` integer,
	`resolved_at` integer,
	`resolve_note` text,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "reports_status_check" CHECK("reports"."status" in ('open', 'resolved', 'dismissed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_open_unique_idx` ON `reports` (`reporter_id`,`target_type`,`target_id`) WHERE "reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX `reports_status_id_idx` ON `reports` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `reports_target_idx` ON `reports` (`target_type`,`target_id`);--> statement-breakpoint
ALTER TABLE `audit_log` ADD `reverses_id` integer;--> statement-breakpoint
CREATE INDEX `audit_log_target_idx` ON `audit_log` (`target_type`,`target_id`,`id`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_idx` ON `audit_log` (`actor`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_log_reverses_idx` ON `audit_log` (`reverses_id`) WHERE "audit_log"."reverses_id" is not null;