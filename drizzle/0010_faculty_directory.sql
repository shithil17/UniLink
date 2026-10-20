-- Faculty now covers every department: initials become optional, and rows gain a department, an NSU page and a hidden flag.
-- SQLite cannot drop NOT NULL in place, and rebuilding the table would make DROP TABLE fire attempts.faculty_id's
-- ON DELETE SET NULL. So the initials column is swapped for a nullable one instead: row ids never change and
-- attempts keep pointing at the same faculty. Empty initials (people NSU lists without a code) become NULL.
ALTER TABLE `faculty` ADD `initials_new` text;--> statement-breakpoint
UPDATE `faculty` SET `initials_new` = NULLIF(`initials`, '');--> statement-breakpoint
ALTER TABLE `faculty` DROP COLUMN `initials`;--> statement-breakpoint
ALTER TABLE `faculty` RENAME COLUMN `initials_new` TO `initials`;--> statement-breakpoint
ALTER TABLE `faculty` ADD `department` text DEFAULT 'ECE' NOT NULL;--> statement-breakpoint
ALTER TABLE `faculty` ADD `nsu_page` text;--> statement-breakpoint
ALTER TABLE `faculty` ADD `hidden` integer DEFAULT false NOT NULL;--> statement-breakpoint
DROP INDEX `faculty_name_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `faculty_name_department_idx` ON `faculty` (`name`,`department`);--> statement-breakpoint
CREATE UNIQUE INDEX `faculty_initials_idx` ON `faculty` (lower(`initials`)) WHERE "initials" is not null;--> statement-breakpoint
CREATE INDEX `faculty_department_idx` ON `faculty` (`department`);
