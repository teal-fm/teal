import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const status = sqliteTable("status", {
  uri: text().primaryKey(),
  authorDid: text().notNull(),
  status: text().notNull(),
  createdAt: text().notNull(),
  indexedAt: text().notNull(),
});

/// ATP Auth Tables (oAuth)
export const atProtoSession = sqliteTable("atp_session", {
  key: text().primaryKey(),
  session: text().notNull(),
});

/// Auth verification table - used for device auth flow
export const authVerification = sqliteTable("auth_verification", {
  state: text().primaryKey(),
  expiry: text().notNull(),
  authSession: text().notNull(),
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
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  follower: text().notNull(),
  followed: text().notNull(),
  createdAt: text().notNull(),
});
