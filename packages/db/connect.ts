import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@teal/db/schema";
import process from "node:process";
import path from "node:path";

// is prod?
let db_relative_location = "../../db.sqlite";
if (process.env.NODE_ENV === "production") {
  db_relative_location = "./db.sqlite";
}

console.log("Loading SQLite file at", path.join(process.cwd(), db_relative_location));

export const db = drizzle({
  connection:
    // default is in project root / db.sqlite
    process.env.DATABASE_URL ??
    "file:" + path.join(process.cwd(), db_relative_location),
  casing: "snake_case",
  schema: schema,
});

export type Database = typeof db;
