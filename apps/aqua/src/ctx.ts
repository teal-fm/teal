import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { Client } from "@libsql/client/.";
import { LibSQLDatabase } from "drizzle-orm/libsql";
import { Context, Next } from "hono";
import { Logger } from "pino";
import { atclient } from "./auth/client";

export type TealContext = Context<EnvWithCtx, any, any>;

export type EnvWithCtx = {
  Variables: Ctx;
};

export type Ctx = {
  auth: NodeOAuthClient;
  db: LibSQLDatabase<typeof import("@teal/db/schema")> & {
    $client: Client;
  };
  logger: Logger<never, boolean>;
};

export const setupContext = async (
  c: TealContext,
  db: LibSQLDatabase<typeof import("@teal/db/schema")> & {
    $client: Client;
  },
  logger: Logger<never, boolean>,
  next: Next,
) => {
  c.set("db", db);
  c.set("auth", atclient);
  c.set("logger", logger);
  await next();
};
