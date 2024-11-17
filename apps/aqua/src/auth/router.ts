import { atclient } from "./client";
import { db } from "@teal/db/connect";
import { EnvWithCtx, TealContext } from "@/ctx";
import { Hono } from "hono";
import { tealSession } from "@teal/db/schema";
import { setCookie } from "hono/cookie";
import { env } from "@/lib/env";

export async function callback(c: TealContext) {
  // Initiate the OAuth flow
  try {
    const honoParams = c.req.query();
    console.log("params", honoParams);
    const params = new URLSearchParams(honoParams);
    const { session } = await atclient.callback(params);

    const did = session.did;

    // Process successful authentication here
    console.log("User authenticated as:", did);

    // gen opaque tealSessionKey
    const sess = crypto.randomUUID();
    await db
      .insert(tealSession)
      .values({
        key: sess,
        // ATP session key (DID)
        session: JSON.stringify(did),
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

    return c.redirect("/");
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user" });
  }
}

const app = new Hono<EnvWithCtx>();

app.get("/callback", async (c) => callback(c));

export const getAuthRouter = () => {
  return app;
};
