import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  pgEnum,
  timestamp,
  uuid,
  integer,
  jsonb,
  primaryKey,
  foreignKey,
  pgMaterializedView,
} from "drizzle-orm/pg-core";
import { createDeflate } from "node:zlib";

export const artists = pgTable("artists", {
  mbid: uuid("mbid").primaryKey(),
  name: text("name").notNull(),
  playCount: integer("play_count").default(0),
});

export const plays = pgTable("plays", {
  cid: text("cid").notNull(),
  did: text("did").notNull(),
  duration: integer("duration"),
  isrc: text("isrc"),
  musicServiceBaseDomain: text("music_service_base_domain"),
  originUrl: text("origin_url"),
  playedTime: timestamp("played_time", { withTimezone: true }),
  processedTime: timestamp("processed_time", {
    withTimezone: true,
  }).defaultNow(),
  rkey: text("rkey").notNull(),
  recordingMbid: uuid("recording_mbid").references(() => recordings.mbid),
  releaseMbid: uuid("release_mbid").references(() => releases.mbid),
  releaseName: text("release_name"),
  submissionClientAgent: text("submission_client_agent"),
  trackName: text("track_name").notNull(),
  uri: text("uri").primaryKey(),
});

export const playToArtists = pgTable(
  "play_to_artists",
  {
    artistMbid: uuid("artist_mbid")
      .references(() => artists.mbid)
      .notNull(),
    artistName: text("artist_name"),
    playUri: text("play_uri")
      .references(() => plays.uri)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.playUri, table.artistMbid] })],
);

export const recordings = pgTable("recordings", {
  mbid: uuid("mbid").primaryKey(),
  name: text("name").notNull(),
  playCount: integer("play_count").default(0),
});

export const releases = pgTable("releases", {
  mbid: uuid("mbid").primaryKey(),
  name: text("name").notNull(),
  playCount: integer("play_count").default(0),
});

export const mvArtistPlayCounts = pgMaterializedView(
  "mv_artist_play_counts",
).as((qb) => {
  return qb
    .select({
      artistMbid: artists.mbid,
      artistName: artists.name,
      playCount: sql<number>`count(${plays.uri})`.as("play_count"),
    })
    .from(artists)
    .leftJoin(playToArtists, sql`${artists.mbid} = ${playToArtists.artistMbid}`)
    .leftJoin(plays, sql`${plays.uri} = ${playToArtists.playUri}`)
    .groupBy(artists.mbid, artists.name);
});

export const mvGlobalPlayCount = pgMaterializedView("mv_global_play_count").as(
  (qb) => {
    return qb
      .select({
        totalPlays: sql<number>`count(${plays.uri})`.as("total_plays"),
        uniqueListeners: sql<number>`count(distinct ${plays.did})`.as(
          "unique_listeners",
        ),
      })
      .from(plays);
  },
);

export const mvRecordingPlayCounts = pgMaterializedView(
  "mv_recording_play_counts",
).as((qb) => {
  return qb
    .select({
      recordingMbid: recordings.mbid,
      recordingName: recordings.name,
      playCount: sql<number>`count(${plays.uri})`.as("play_count"),
    })
    .from(recordings)
    .leftJoin(plays, sql`${plays.recordingMbid} = ${recordings.mbid}`)
    .groupBy(recordings.mbid, recordings.name);
});

export const mvReleasePlayCounts = pgMaterializedView(
  "mv_release_play_counts",
).as((qb) => {
  return qb
    .select({
      releaseMbid: releases.mbid,
      releaseName: releases.name,
      playCount: sql<number>`count(${plays.uri})`.as("play_count"),
    })
    .from(releases)
    .leftJoin(plays, sql`${plays.releaseMbid} = ${releases.mbid}`)
    .groupBy(releases.mbid, releases.name);
});

export const mvTopArtists30Days = pgMaterializedView(
  "mv_top_artists_30days",
).as((qb) => {
  return qb
    .select({
      artistMbid: artists.mbid,
      artistName: artists.name,
      playCount: sql<number>`count(${plays.uri})`.as("play_count"),
    })
    .from(artists)
    .innerJoin(
      playToArtists,
      sql`${artists.mbid} = ${playToArtists.artistMbid}`,
    )
    .innerJoin(plays, sql`${plays.uri} = ${playToArtists.playUri}`)
    .where(sql`${plays.playedTime} >= NOW() - INTERVAL '30 days'`)
    .groupBy(artists.mbid, artists.name)
    .orderBy(sql`count(${plays.uri}) DESC`);
});

export const mvTopReleases30Days = pgMaterializedView(
  "mv_top_releases_30days",
).as((qb) => {
  return qb
    .select({
      releaseMbid: releases.mbid,
      releaseName: releases.name,
      playCount: sql<number>`count(${plays.uri})`.as("play_count"),
    })
    .from(releases)
    .innerJoin(plays, sql`${plays.releaseMbid} = ${releases.mbid}`)
    .where(sql`${plays.playedTime} >= NOW() - INTERVAL '30 days'`)
    .groupBy(releases.mbid, releases.name)
    .orderBy(sql`count(${plays.uri}) DESC`);
});

export const profiles = pgTable("profiles", {
  did: text("did").primaryKey(),
  handle: text("handle"),
  displayName: text("display_name"),
  description: text("description"),
  descriptionFacets: jsonb("description_facets"),
  // the IPLD of the image. bafy...
  avatar: text("avatar"),
  banner: text("banner"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const userFeaturedItems = pgTable("featured_items", {
  did: text("did").primaryKey(),
  mbid: text("mbid").notNull(),
  type: text("type").notNull(),
});

export const mvTopArtistsForUser30Days = pgMaterializedView(
  "mv_top_artists_for_user_30days",
).as((qb) => {
  return qb
    .select({
      artistMbid: artists.mbid,
      artistName: artists.name,
      playCount: sql<number>`count(${plays.uri})`.as("play_count"),
    })
    .from(artists)
    .innerJoin(
      playToArtists,
      sql`${artists.mbid} = ${playToArtists.artistMbid}`,
    )
    .innerJoin(plays, sql`${plays.uri} = ${playToArtists.playUri}`)
    .innerJoin(profiles, sql`${profiles.did} = ${plays.did}`)
    .where(sql`${plays.playedTime} >= NOW() - INTERVAL '30 days'`)
    .groupBy(artists.mbid, artists.name)
    .orderBy(sql`count(${plays.uri}) DESC`);
});

export const mvTopArtistsForUser7Days = pgMaterializedView(
  "mv_top_artists_for_user_7days",
).as((qb) => {
  return qb
    .select({
      artistMbid: artists.mbid,
      artistName: artists.name,
      playCount: sql<number>`count(${plays.uri})`.as("play_count"),
    })
    .from(artists)
    .innerJoin(
      playToArtists,
      sql`${artists.mbid} = ${playToArtists.artistMbid}`,
    )
    .innerJoin(plays, sql`${plays.uri} = ${playToArtists.playUri}`)
    .innerJoin(profiles, sql`${profiles.did} = ${plays.did}`)
    .where(sql`${plays.playedTime} >= NOW() - INTERVAL '7 days'`)
    .groupBy(artists.mbid, artists.name)
    .orderBy(sql`count(${plays.uri}) DESC`);
});

export const mvTopReleasesForUser30Days = pgMaterializedView(
  "mv_top_releases_for_user_30days",
).as((qb) => {
  return qb
    .select({
      releaseMbid: releases.mbid,
      releaseName: releases.name,
      playCount: sql<number>`count(${plays.uri})`.as("play_count"),
    })
    .from(releases)
    .innerJoin(plays, sql`${plays.releaseMbid} = ${releases.mbid}`)
    .innerJoin(profiles, sql`${profiles.did} = ${plays.did}`)
    .where(sql`${plays.playedTime} >= NOW() - INTERVAL '30 days'`)
    .groupBy(releases.mbid, releases.name)
    .orderBy(sql`count(${plays.uri}) DESC`);
});

export const mvTopReleasesForUser7Days = pgMaterializedView(
  "mv_top_releases_for_user_7days",
).as((qb) => {
  return qb
    .select({
      releaseMbid: releases.mbid,
      releaseName: releases.name,
      playCount: sql<number>`count(${plays.uri})`.as("play_count"),
    })
    .from(releases)
    .innerJoin(plays, sql`${plays.releaseMbid} = ${releases.mbid}`)
    .innerJoin(profiles, sql`${profiles.did} = ${plays.did}`)
    .where(sql`${plays.playedTime} >= NOW() - INTERVAL '7 days'`)
    .groupBy(releases.mbid, releases.name)
    .orderBy(sql`count(${plays.uri}) DESC`);
});
