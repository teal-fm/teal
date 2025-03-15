CREATE TABLE "profiles" (
	"did" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"description" text NOT NULL,
	"description_facets" jsonb NOT NULL,
	"avatar" text NOT NULL,
	"banner" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "featured_items" (
	"did" text PRIMARY KEY NOT NULL,
	"mbid" text NOT NULL,
	"type" text NOT NULL
);
