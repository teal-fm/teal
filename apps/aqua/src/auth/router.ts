import { atclient } from "./client";
import { db } from "@teal/db/connect";
import {atProtoSession} from "@teal/db/schema"
import { eq } from "drizzle-orm"
import { EnvWithCtx, TealContext } from "@/ctx";
import { Hono } from "hono";
import { tealSession } from "@teal/db/schema";
import { setCookie } from "hono/cookie";
import { env } from "@/lib/env";

export async function callback(c: TealContext) {
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

    if(params.get("spa")) {
      return c.json({
        provider: "atproto",
        jwt: did,
        accessToken: did,
      })
    }

    return c.redirect("/");
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user" });
  }
}


// Refresh an access token from a refresh token. Should be only used in SPAs.
// Pass in 'key' and 'refresh_token' query params.
export async function refresh(c: TealContext) {
  try {
    const honoParams = c.req.query();
    console.log("params", honoParams);
    const params = new URLSearchParams(honoParams);
    let key = params.get("key");
    let refresh_token = params.get("refresh_token");
    if(!key || !refresh_token) {
      return Response.json({error: "Missing key or refresh_token"});
    }
    // check if refresh token is valid
    let r_tk_check = await db.select().from(atProtoSession).where(eq(atProtoSession.key, key)).execute() as any;

    if(r_tk_check.tokenSet.refresh_token !== refresh_token) {
      return Response.json({error: "Invalid refresh token"});
    }


    const session = await atclient.restore(key);

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

    return c.json({
      provider:"atproto",
      jwt: did,
      accessToken: did,
    })
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user" });
  }
}

const app = new Hono<EnvWithCtx>();

app.get("/callback", async (c) => callback(c));
app.get("/refresh", async (c) => refresh(c));

export const getAuthRouter = () => {
  return app;
};
