import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import process from "node:process";
import path from "node:path";

console.log("Loading SQLite file at", path.join(process.cwd(), "./db.sqlite"));

export const db = drizzle({
  connection:
    // default is in project root / db.sqlite
    process.env.DATABASE_URL ??
    "file:" + path.join(process.cwd(), "./db.sqlite"),
  // doesn't seem to work?
  //casing: "snake_case",
  schema: schema,
});

export type Database = typeof db;
