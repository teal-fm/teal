import { Hono } from "hono";
import { EnvWithCtx } from "./ctx";

const app = new Hono<EnvWithCtx>();

app.get("/me", async (c) => {
  getSession(c);
});

app.post("/status", async (c) => {
  const result = await c.db.query.status.insert({
    uri: c.req.body.uri,
    authorDid: c.req.body.authorDid,
    status: c.req.body.status,
    createdAt: new Date().toISOString(),
    indexedAt: new Date().toISOString(),
  });
  return c.json(result);
});

export default app;
