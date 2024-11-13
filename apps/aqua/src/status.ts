import { Hono } from "hono";
import { EnvWithCtx } from "./ctx";
import { getSession } from "./lib/auth";

const app = new Hono<EnvWithCtx>();

app.get("/me", async (c) => {
  getSession(c);
});

app.post("/status", async (c) => {
  let db = c.get("db");
  return c.json({ status: "todo" });
});

export default app;
