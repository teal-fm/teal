import { Ctx, EnvWithCtx } from "@/ctx";
import { db } from "@teal/db/connect";
import { Agent, lexicons } from "@atproto/api";
import { NodeOAuthClient, Session } from "@atproto/oauth-client-node";
import { tealSession } from "@teal/db/schema";
import { eq } from "drizzle-orm";
import { Context } from "hono";
import { getCookie } from "hono/cookie";

interface UserSession {
  did: string;
  /// The session JWT from ATProto
  session: Session;
}

interface UserInfo {
  did: string;
  handle: string;
}

export async function getSessionAgent(
  c: Context<EnvWithCtx>,
  did: string,
): Promise<Agent> {
  const session = await getSession(c);
  const auth = c.get("auth");
  try {
    const session = await auth.restore(did);
    if (session) {
      return new Agent(session);
    }
    throw new Error("Failed to restore session");
  } catch (e) {
    console.error(e);
    throw new Error("Failed to restore session" + e);
  }
}

export async function getUserInfo(
  c: Context<EnvWithCtx>,
  did: string,
): Promise<UserInfo> {
  // init session agent
  const agent = await getSessionAgent(c, did);
  // fetch from ATProto
  const res = await agent.app.bsky.actor.getProfile({
    actor: did,
  });
  if (res.success) {
    return {
      did,
      handle: res.data.handle,
      email: res.data.email,
    };
  } else {
    throw new Error("Failed to fetch user info");
  }
}

/**
 * Get the auth session from the request cookie or Authorization header
 */
export async function getAuthSession(c: Context<EnvWithCtx>): Promise<Session> {
  let authSession = getCookie(c, "authSession");
  if (!authSession) {
    authSession = c.req.header("Authorization");
  }
  if (!authSession) {
    throw new Error("No auth session found");
  } else {
    // get the DID from the session
    const did = await db
      .select()
      .from(tealSession)
      .where(eq(tealSession.key, authSession))
      .limit(1)
      .all()
      .then((result) => result[0]?.session);
    if (!did) {
      throw new Error("No DID found in session");
    }
    return getATPAuthSession(c, did);
  }
}

export async function getSession(c: Context<EnvWithCtx>): Promise<Session> {
  let authSession = getCookie(c, "tealSession")?.split("teal:")[1];
  console.log(`tealSession cookie: ${authSession}`);
  if (!authSession) {
    authSession = c.req.header("Authorization");
  }
  if (!authSession) {
    throw new Error("No auth session found");
  } else {
    // get the DID from the session
    const did = await db
      .select()
      .from(tealSession)
      .where(eq(tealSession.key, authSession))
      .limit(1)
      .all()
      .then((result) => result[0]?.session);
    if (!did) {
      throw new Error("No DID found in session");
    }
    return getATPAuthSession(c, did.replace(/['"]/g, ""));
  }
}

// get the auth session from cookie or Authorization header
export async function getATPAuthSession(
  c: Context<EnvWithCtx>,
  did: string,
): Promise<Session> {
  let auth: NodeOAuthClient = c.get("auth");
  const jwt = await auth.restore(did);
  if (jwt) {
    return jwt;
  }
  throw new Error("No auth session found");
}
