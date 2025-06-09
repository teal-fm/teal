import { EnvWithCtx } from "@/ctx";
import { Hono } from "hono";
import { logger } from "hono/logger";

import getProfile from "./actor/getProfile";
import searchActors from "./actor/searchActors";
import getActorFeed from "./feed/getActorFeed";
import getPlay from "./feed/getPlay";

// mount this on /xrpc
const app = new Hono<EnvWithCtx>();

app.use(logger());

app.get("fm.teal.alpha.feed.getPlay", async (c) => c.json(await getPlay(c)));
app.get("fm.teal.alpha.feed.getActorFeed", async (c) =>
  c.json(await getActorFeed(c)),
);

app.get("fm.teal.alpha.actor.getProfile", async (c) =>
  c.json(await getProfile(c)),
);

app.get("fm.teal.alpha.actor.searchActors", async (c) =>
  c.json(await searchActors(c)),
);

export const getXrpcRouter = () => {
  return app;
};
