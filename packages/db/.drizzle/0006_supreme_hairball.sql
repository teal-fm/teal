PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_play` (
	`uri` text PRIMARY KEY NOT NULL,
	`author_did` text NOT NULL,
	`created_at` text NOT NULL,
	`indexed_at` text NOT NULL,
	`track_name` text NOT NULL,
	`track_mb_id` text,
	`recording_mb_id` text,
	`duration` integer,
	`artist_names` text,
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
INSERT INTO `__new_play`("uri", "author_did", "created_at", "indexed_at", "track_name", "track_mb_id", "recording_mb_id", "duration", "artist_names", "artist_mb_ids", "release_name", "release_mb_id", "isrc", "origin_url", "music_service_base_domain", "submission_client_agent", "played_time") SELECT "uri", "author_did", "created_at", "indexed_at", "track_name", "track_mb_id", "recording_mb_id", "duration", "artist_name", "artist_mb_ids", "release_name", "release_mb_id", "isrc", "origin_url", "music_service_base_domain", "submission_client_agent", "played_time" FROM `play`;--> statement-breakpoint
DROP TABLE `play`;--> statement-breakpoint
ALTER TABLE `__new_play` RENAME TO `play`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
