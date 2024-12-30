import {
  numeric,
  sqliteTable,
  text,
  customType,
  integer,
} from "drizzle-orm/sqlite-core";

// string array custom type
const json = <TData>() =>
  customType<{ data: TData; driverData: string }>({
    dataType() {
      return "text";
    },
    toDriver(value: TData): string {
      return JSON.stringify(value);
    },
  })();

// Tables

export const status = sqliteTable("status", {
  uri: text().primaryKey(),
  authorDid: text().notNull(),
  status: text().notNull(),
  createdAt: text().notNull(),
  indexedAt: text().notNull(),
});

// ATP Auth Tables (oAuth)
export const atProtoSession = sqliteTable("atp_session", {
  key: text().primaryKey(),
  session: text().notNull(),
});

export const authState = sqliteTable("auth_state", {
  key: text().primaryKey(),
  state: text().notNull(),
});

export const tealSession = sqliteTable("teal_session", {
  key: text().primaryKey(),
  session: text().notNull(),
  provider: text().notNull(),
});

// Regular Auth Tables
export const tealUser = sqliteTable("teal_user", {
  did: text().primaryKey(),
  handle: text().notNull(),
  avatar: text().notNull(),
  bio: text(),
  createdAt: text().notNull(),
});

// follow relationship
export const follow = sqliteTable("follow", {
  relId: text().primaryKey(),
  follower: text().notNull(),
  followed: text().notNull(),
  createdAt: text().notNull(),
});

// play
export const play = sqliteTable("play", {
  uri: text().primaryKey(),
  authorDid: text().notNull(),
  createdAt: text().notNull(),
  indexedAt: text().notNull(),

  /** The name of the track */
  trackName: text().notNull(),
  /** The Musicbrainz ID of the track */
  trackMbId: text(),
  /** The Musicbrainz recording ID of the track */
  recordingMbId: text(),
  /** The length of the track in seconds */
  duration: integer(),
  /** The name of the artist */
  artistName: text().notNull(),
  /** Array of Musicbrainz artist IDs */
  // type of string[]
  artistMbIds: json<string[]>(),
  /** The name of the release/album */
  releaseName: text(),
  /** The Musicbrainz release ID */
  releaseMbId: text(),
  /** The ISRC code associated with the recording */
  isrc: text(),
  /** The URL associated with this track */
  originUrl: text(),
  /** The base domain of the music service. e.g. music.apple.com, tidal.com, spotify.com. */
  musicServiceBaseDomain: text(),
  /** A user-agent style string specifying the user agent. e.g. tealtracker/0.0.1b */
  submissionClientAgent: text(),
  /** The unix timestamp of when the track was played */
  playedTime: text(),
});
