import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import process from "node:process";

export const db = drizzle({
  connection: process.env.DATABASE_URL ?? "file:./db.sqlite",
  // doesn't seem to work?
  //casing: "snake_case",
  schema: schema,
});

export type Database = typeof db;
