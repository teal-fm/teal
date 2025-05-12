import path from "node:path";
import process from "node:process";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/// Trim a password from a db connection url
function withoutPassword(url: string) {
  const urlObj = new URL(url);
  urlObj.password = "*****";
  return urlObj.toString();
}

console.log(
  "Connecting to database at " +
    withoutPassword(process.env.DATABASE_URL ?? ""),
);

const client = postgres(process.env.DATABASE_URL ?? "");

export const db = drizzle({
  client,
  schema: schema,
});

// If you need to export the type:
export type Database = typeof db;
