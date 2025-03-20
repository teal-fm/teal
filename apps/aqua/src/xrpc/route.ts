import { EnvWithCtx } from '@/ctx';
import { Hono } from 'hono';
import getPlay from './feed/getPlay';
import getActorFeed from './feed/getActorFeed';
import getProfile from './actor/getProfile';
import searchActors from './actor/searchActors';

// mount this on /xrpc
const app = new Hono<EnvWithCtx>();

app.get('fm.teal.alpha.feed.getPlay', async (c) => c.json(await getPlay(c)));
app.get('fm.teal.alpha.feed.getActorFeed', async (c) =>
  c.json(await getActorFeed(c)),
);

app.get('fm.teal.alpha.actor.getProfile', async (c) =>
  c.json(await getProfile(c)),
);

app.get('fm.teal.alpha.actor.searchActors', async (c) =>
  c.json(await searchActors(c)),
);

export const getXrpcRouter = () => {
  return app;
};
