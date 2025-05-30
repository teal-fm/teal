import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

//Loads from root .env
dotenvExpand.expand(dotenv.config({ path: '../../.env' }));
//Or can be overridden by .env in the current folder
dotenvExpand.expand(dotenv.config());



export default defineConfig({
  dialect: "postgresql",
  schema: "./schema.ts",
  out: "./.drizzle",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
