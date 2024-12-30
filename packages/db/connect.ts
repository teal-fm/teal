import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import process from "node:process";
import path from "node:path";

console.log("Loading SQLite file at", path.join(process.cwd(), "./../../db.sqlite"));

const client = createClient({
  url:
    process.env.DATABASE_URL ??
    "file:" + path.join(process.cwd(), "./../../db.sqlite"),
});

export const db = drizzle(client, {
  schema: schema,
});

// If you need to export the type:
export type Database = typeof db;
