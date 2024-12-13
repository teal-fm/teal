import { atclient } from "./client";
import { db } from "@teal/db/connect";
import { atProtoSession } from "@teal/db/schema";
import { eq } from "drizzle-orm";
import { EnvWithCtx, TealContext } from "@/ctx";
import { Hono } from "hono";
import { tealSession } from "@teal/db/schema";
import { setCookie } from "hono/cookie";
import { env } from "@/lib/env";

const publicUrl = env.PUBLIC_URL;
const redirectBase = publicUrl || `http://127.0.0.1:${env.PORT}`;

export function generateState(prefix?: string) {
  const state = crypto.randomUUID();
  return `${prefix}${prefix ? ":" : ""}${state}`;
}

const SPA_PREFIX = "a37d";

// /oauth/login?handle=teal.fm
export async function login(c: TealContext) {
  const { handle, spa } = c.req.query();
  if (!handle) {
    return Response.json({ error: "Missing handle" });
  }
  const url = await atclient.authorize(handle, {
    scope: "atproto transition:generic",
    // state.appState in callback
    state: generateState(spa ? SPA_PREFIX : undefined),
  });
  return c.json({ url });
}

// Redirect to the app's callback URL.
async function callbackToApp(c: TealContext) {
  const queries = c.req.query();
  const params = new URLSearchParams(queries);
  return c.redirect(`${env.APP_URI}/oauth/callback?${params.toString()}`);
}

export async function callback(c: TealContext, isSpa: boolean = false) {
  try {
    const honoParams = c.req.query();
    console.log("params", honoParams);
    const params = new URLSearchParams(honoParams);

    const { session, state } = await atclient.callback(params);

    console.log("state", state);

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

    if (isSpa) {
      return c.json({
        provider: "atproto",
        jwt: did,
        accessToken: did,
      });
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
    if (!key || !refresh_token) {
      return Response.json({ error: "Missing key or refresh_token" });
    }
    // check if refresh token is valid
    let r_tk_check = (await db
      .select()
      .from(atProtoSession)
      .where(eq(atProtoSession.key, key))
      .execute()) as any;

    if (r_tk_check.tokenSet.refresh_token !== refresh_token) {
      return Response.json({ error: "Invalid refresh token" });
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
      provider: "atproto",
      jwt: did,
      accessToken: did,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user" });
  }
}

const app = new Hono<EnvWithCtx>();

app.get("/login", async (c) => login(c));
app.get("/callback", async (c) => callback(c));
app.get("/callback/app", async (c) => callback(c, true));
app.get("/refresh", async (c) => refresh(c));

export const getAuthRouter = () => {
  return app;
};
