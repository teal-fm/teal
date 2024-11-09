CREATE TABLE `teal_session` (
	`key` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`provider` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teal_user` (
	`did` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
