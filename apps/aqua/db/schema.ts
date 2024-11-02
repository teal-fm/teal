import { defineConfig } from "drizzle-kit";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export default defineConfig({
  dialect: "sqlite", // 'mysql' | 'postgresql' | 'sqlite' | 'turso'
  schema: "./src/db/schema.ts",
});

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

export const authSession = sqliteTable("auth_session", {
  key: text().primaryKey(),
  session: text().notNull(),
});

export const authState = sqliteTable("auth_state", {
  key: text().primaryKey(),
  state: text().notNull(),
});
