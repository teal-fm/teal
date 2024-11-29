import { atclient } from "./client";
import { db } from "@teal/db/connect";
import { atProtoSession, authVerification } from "@teal/db/schema";
import { eq } from "drizzle-orm";
import { EnvWithCtx, TealContext } from "@/ctx";
import { Hono } from "hono";
import { tealSession } from "@teal/db/schema";
import { setCookie } from "hono/cookie";
import { env } from "@/lib/env";
import { NodeSavedSession } from "@atproto/oauth-client-node";

const publicUrl = env.PUBLIC_URL;
const redirectBase = publicUrl || `http://127.0.0.1:${env.PORT}`;

/// Generate a state string that is unique to the current request
/// in the format of `prefix:state+timestamp`. prefix: is optional.
/// Timestamp is in ms, default is 15 minutes
export function generateState(prefix?: string, expiry: number = 900000): string{
  const state = crypto.randomUUID();
  return `${prefix}${prefix ? ":" : ""}${state}+${Date.now() + expiry}`;
}

const SPA_PREFIX = "a37d";

// /oauth/login?handle=teal.fm
export async function login(c: TealContext) {
  const { handle, spa } = c.req.query();
  if (!handle) {
    return Response.json({ error: "Missing handle" });
  }
  const state = generateState(spa ? SPA_PREFIX : undefined);
  const url = await atclient.authorize(handle, {
    scope: "atproto transition:generic",
    // state.appState in callback
    state,
  });
  return c.json({ url, state });
}

// Redirect to the app's callback URL.
async function callbackApp(c: TealContext) {
  const state = c.req.query("state");
  if (state && state.startsWith(SPA_PREFIX)) {
    // provide the state to the app
    let auth = await db.select().from(authVerification).where(eq(authVerification.state, state)).execute();
    // delete the tokens
    await db
      .delete(authVerification)
      .where(eq(authVerification.state, state))
      .execute();
    
    // if expiry is in the past, return an error
    if (auth[0].expiry < Date.now().toString()) {
      return c.json({ error: "Expired state"})
    }

    console.log("Looking up session associated with key", auth[0]);

    // look up the associated session
    const session = await db
      .select()
      .from(atProtoSession)
      .where(eq(atProtoSession.key, auth[0].authSession))
      .execute();
    
    if(!session[0]){
      return c.json({ error: "Invalid state - Could not find session"})
    }
    return c.json(session[0].session);
  } else {
    return c.json({ error: "Invalid state"})
  }
}

/// Handle the callback from ATProto
export async function callback(c: TealContext) {
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

    if (state && state.startsWith(SPA_PREFIX)) {
      // insert the code and the tokens to be exchanged by the app
      console.log("Inserting verification code:", state);
      await db.insert(authVerification).values({
        authSession: session.sub,
        expiry: state.split("+")[1],
        state: state,
      });
      // redirect back to app
      return c.redirect("exp://127.0.0.1:8081/--/auth/callback?success=true");
    } else {
      console.log("Setting cookie", sess);
      setCookie(c, "tealSession", "teal:" + sess, {
        httpOnly: true,
        secure: env.HOST.startsWith("https"),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return c.redirect("/");
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user: " + (e as Error).message });
  }
}

/// Refresh an access token from a refresh token. Should be only used in SPAs.
/// Pass in 'key' and 'refresh_token' query params.
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
    let r_tk_check = await db
      .select()
      .from(atProtoSession)
      .where(eq(atProtoSession.key, key))
      .execute()
    
    const tk: NodeSavedSession = JSON.parse(r_tk_check[0].session);

    if (tk.tokenSet.refresh_token !== refresh_token) {
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
app.get("/callback/app", async (c) => callbackApp(c));
app.get("/refresh", async (c) => refresh(c));

export const getAuthRouter = () => {
  return app;
};