PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_follow` (
	`rel_id` text PRIMARY KEY NOT NULL,
	`follower` text NOT NULL,
	`followed` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_follow`("rel_id", "follower", "followed", "created_at") SELECT '0', "follower", "followed", "created_at" FROM `follow`;--> statement-breakpoint
DROP TABLE `follow`;--> statement-breakpoint
ALTER TABLE `__new_follow` RENAME TO `follow`;--> statement-breakpoint
PRAGMA foreign_keys=ON;