import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export type DatabaseSchema = {
  status: Status;
  auth_session: AuthSession;
  auth_state: AuthState;
};

export type Status = {
  uri: string;
  authorDid: string;
  status: string;
  createdAt: string;
  indexedAt: string;
};

export type AuthSession = {
  key: string;
  session: AuthSessionJson;
};

export type AuthState = {
  key: string;
  state: AuthStateJson;
};

type AuthStateJson = string;

type AuthSessionJson = string;

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
  follower: text().primaryKey(),
  followed: text().primaryKey(),
  createdAt: text().notNull(),
});
