import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Context, Next } from "hono";
import { Logger } from "pino";

import { db as tdb } from "@teal/db";

export type TealContext = Context<EnvWithCtx, any, any>;

export type EnvWithCtx = {
  Variables: Ctx;
};

export type Ctx = {
  auth: NodeOAuthClient;
  db: typeof tdb;
  logger: Logger<never, boolean>;
};

export const setupContext = async (
  c: TealContext,
  db: typeof tdb,
  logger: Logger<never, boolean>,
  next: Next,
) => {
  c.set("db", db);
  c.set("logger", logger);
  await next();
};
