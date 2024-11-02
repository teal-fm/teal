CREATE TABLE `auth_session` (
	`key` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_state` (
	`key` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `status` (
	`uri` text PRIMARY KEY NOT NULL,
	`authorDid` text NOT NULL,
	`status` text NOT NULL,
	`createdAt` text NOT NULL,
	`indexedAt` text NOT NULL
);
