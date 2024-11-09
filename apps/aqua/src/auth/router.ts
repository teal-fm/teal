import { createClient } from "./client";
import { db } from "@/db";
import { EnvWithCtx, TealContext } from "@/ctx";
import { Hono } from "hono";
import { tealSession } from "@teal/db/schema";

import { setCookie } from "hono/cookie";
import { env } from "@/lib/env";

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

export async function loginGet(c: TealContext) {
  const handle = c.req.param('handle');
  // Initiate the OAuth flow
  const auth = await createClient(db);
  try {
    const url = await auth.authorize(handle, {
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

    let did = cb.session.did;
    // gen opaque tealSessionKey
    const sess = crypto.randomUUID();
    await db
      .insert(tealSession)
      .values({
        key: sess,
        // ATP session key (DID)
        session: JSON.stringify(cb.session.did),
        provider: "atproto",
      })
      .execute();

    // cookie time
    console.log("Setting cookie", sess);
    setCookie(c, "tealSession", "teal:" + sess, {
      httpOnly: true,
      secure: env.HOST.startsWith("https"),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return Response.json({ did, sessionId: sess });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user" });
  }
}

const app = new Hono<EnvWithCtx>();


app.get("/login/:handle", async (c) => loginGet(c));

app.post("/login", async (c) => login(c));

app.get("/callback", async (c) => callback(c));

export const getAuthRouter = () => {
  return app;
};
