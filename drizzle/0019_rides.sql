CREATE TABLE `rides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`pickup` text NOT NULL,
	`destination` text NOT NULL,
	`vehicle` text NOT NULL,
	`total_seats` integer NOT NULL,
	`seats_remaining` integer NOT NULL,
	`price_per_seat_taka` integer NOT NULL,
	`notes` text,
	`contact_phone` text,
	`contact_whatsapp` text,
	`contact_messenger` text,
	`kind` text NOT NULL,
	`departs_at` integer,
	`days` integer,
	`departure_minutes` integer,
	`ends_on` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`moderation_category` text,
	`moderation_flags` text,
	`moderation_confidence` real,
	`moderation_model` text,
	`moderation_appealed_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` integer,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "rides_status_check" CHECK("rides"."status" in ('published', 'pending_review', 'rejected')),
	CONSTRAINT "rides_contact_check" CHECK("rides"."contact_phone" is not null or "rides"."contact_whatsapp" is not null or "rides"."contact_messenger" is not null),
	CONSTRAINT "rides_vehicle_check" CHECK("rides"."vehicle" in ('bike', 'car', 'suv', 'bus')),
	CONSTRAINT "rides_seats_check" CHECK("rides"."total_seats" between 1 and 60 and "rides"."seats_remaining" between 0 and "rides"."total_seats"),
	CONSTRAINT "rides_price_check" CHECK("rides"."price_per_seat_taka" >= 0),
	CONSTRAINT "rides_kind_check" CHECK(("rides"."kind" = 'one_off' and "rides"."departs_at" is not null and "rides"."days" is null and "rides"."departure_minutes" is null and "rides"."ends_on" is null)
        or ("rides"."kind" = 'recurring' and "rides"."departs_at" is null and "rides"."days" is not null and "rides"."days" between 1 and 127 and "rides"."departure_minutes" is not null and "rides"."departure_minutes" between 0 and 1439 and "rides"."ends_on" is not null and "rides"."ends_on" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'))
);
--> statement-breakpoint
CREATE INDEX `rides_status_id_idx` ON `rides` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `rides_author_idx` ON `rides` (`author_id`,`id`);--> statement-breakpoint
CREATE INDEX `rides_expires_idx` ON `rides` (`expires_at`,`id`);--> statement-breakpoint
CREATE INDEX `rides_vehicle_expires_idx` ON `rides` (`vehicle`,`expires_at`);--> statement-breakpoint
CREATE INDEX `rides_kind_departs_idx` ON `rides` (`kind`,`departs_at`);