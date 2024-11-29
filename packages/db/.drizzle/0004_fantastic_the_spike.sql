CREATE TABLE `auth_verification` (
	`state` text PRIMARY KEY NOT NULL,
	`expiry` text NOT NULL,
	`auth_session` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `follow` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`follower` text NOT NULL,
	`followed` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `teal_user` ADD `avatar` text NOT NULL;--> statement-breakpoint
ALTER TABLE `teal_user` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `teal_user` DROP COLUMN `email`;