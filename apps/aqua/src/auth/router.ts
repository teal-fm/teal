import { createClient } from "./client";
import { db } from "@/db";
import { EnvWithCtx, TealContext } from "@/ctx";
import { authSession } from "../../db/schema";
import { Hono } from "hono";

interface LoginBody {
  handle?: string;
}

export const login = async (c: TealContext) => {
  let body: LoginBody = await c.req.json();
  // Initiate the OAuth flow
  const auth = await createClient(db);
  if (!body) return Response.json({ error: "Could not parse body" });
  // handle is the handle of the user
  if (!body.handle && body.handle === undefined)
    return Response.json({ error: "Handle is required" });
  try {
    const url = await auth.authorize(body.handle, {
      scope: "atproto transition:generic",
      state: crypto.randomUUID(),
    });
    return Response.json({ redirect_to: url });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user" });
  }
};

export async function loginGet(handle: string) {
  // Initiate the OAuth flow
  const auth = await createClient(db);
  try {
    const url = await auth.authorize("natalie.sh", {
      scope: "atproto transition:generic",
    });
    return Response.redirect(url);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user" });
  }
}

export async function callback(c: TealContext) {
  // Initiate the OAuth flow
  const auth = await createClient(db);
  try {
    const honoParams = c.req.query();
    console.log("params", honoParams);
    const params = new URLSearchParams(honoParams);
    const cb = await auth.callback(params);

    // generate a session key (random)

    const sessionKey = crypto.randomUUID();

    // insert in session table, return data from cb

    c.var.db.insert(authSession).values({
      key: sessionKey,
      session: JSON.stringify(cb.session),
    });

    return Response.json(cb);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user" });
  }
}

const app = new Hono<EnvWithCtx>();

app.get("/login", async (c) => loginGet("natalie.sh"));

app.post("/login", async (c) => login(c));

app.get("/callback", async (c) => callback(c));

export const getAuthRouter = () => {
  return app;
};
