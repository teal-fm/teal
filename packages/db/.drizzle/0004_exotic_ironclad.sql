CREATE TABLE `follow` (
	`follower` text PRIMARY KEY NOT NULL,
	`followed` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `play` (
	`uri` text PRIMARY KEY NOT NULL,
	`author_did` text NOT NULL,
	`created_at` text NOT NULL,
	`indexed_at` text NOT NULL,
	`track_name` text NOT NULL,
	`track_mb_id` text,
	`recording_mb_id` text,
	`duration` integer,
	`artist_name` text NOT NULL,
	`artist_mb_ids` text,
	`release_name` text,
	`release_mb_id` text,
	`isrc` text,
	`origin_url` text,
	`music_service_base_domain` text,
	`submission_client_agent` text,
	`played_time` text
);
--> statement-breakpoint
ALTER TABLE `teal_user` ADD `avatar` text NOT NULL;--> statement-breakpoint
ALTER TABLE `teal_user` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `teal_user` DROP COLUMN `email`;