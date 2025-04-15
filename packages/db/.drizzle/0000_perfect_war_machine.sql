CREATE TABLE "artists" (
	"mbid" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"play_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "play_to_artists" (
	"play_uri" text NOT NULL,
	"artist_mbid" uuid NOT NULL,
	"artist_name" text,
	CONSTRAINT "play_to_artists_play_uri_artist_mbid_pk" PRIMARY KEY("play_uri","artist_mbid")
);
--> statement-breakpoint
CREATE TABLE "plays" (
	"uri" text PRIMARY KEY NOT NULL,
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"cid" text NOT NULL,
	"isrc" text,
	"duration" integer,
	"track_name" text NOT NULL,
	"played_time" timestamp with time zone,
	"processed_time" timestamp with time zone DEFAULT now(),
	"release_mbid" uuid,
	"release_name" text,
	"recording_mbid" uuid,
	"submission_client_agent" text,
	"music_service_base_domain" text
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"mbid" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"play_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"mbid" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"play_count" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "play_to_artists" ADD CONSTRAINT "play_to_artists_play_uri_plays_uri_fk" FOREIGN KEY ("play_uri") REFERENCES "public"."plays"("uri") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_to_artists" ADD CONSTRAINT "play_to_artists_artist_mbid_artists_mbid_fk" FOREIGN KEY ("artist_mbid") REFERENCES "public"."artists"("mbid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_release_mbid_releases_mbid_fk" FOREIGN KEY ("release_mbid") REFERENCES "public"."releases"("mbid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_recording_mbid_recordings_mbid_fk" FOREIGN KEY ("recording_mbid") REFERENCES "public"."recordings"("mbid") ON DELETE no action ON UPDATE no action;