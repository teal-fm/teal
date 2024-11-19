import { TealContext } from "@/ctx";
import { db } from "@teal/db/connect";
import { Session } from "@atproto/oauth-client-node";
import { tealSession } from "@teal/db/schema";
import { eq } from "drizzle-orm";
import { deleteCookie, getCookie } from "hono/cookie";
import { atclient } from "@/auth/client";
import { Agent } from "@atproto/api";

interface UserSession {
  did: string;
  /// The session JWT from ATProto
  session: Session;
}

interface UserInfo {
  did: string;
  handle: string;
}

export async function getUserInfo(
  c: TealContext
): Promise<UserInfo | undefined> {
  // init session agent
  const agent = await getSessionAgent(c);
  if (agent && agent.did) {
    // fetch from ATProto
    const res = await agent.app.bsky.actor.getProfile({
      actor: agent.did,
    });
    if (res.success) {
      return {
        did: agent.did,
        handle: res.data.handle,
      };
    } else {
      throw new Error("Failed to fetch user info");
    }
  }
}

export async function getContextDID(c: TealContext): Promise<string> {
  let authSession = getCookie(c, "tealSession")?.split("teal:")[1];
  console.log(`tealSession cookie: ${authSession}`);
  if (!authSession) {
    authSession = c.req.header("Authorization");
  }
  if (!authSession) {
    throw new Error("No auth session found");
  } else {
    // get the DID from the session
    const session = await db.query.tealSession.findFirst({
      where: eq(tealSession.key, authSession),
    }).execute();

    if (!session) {
      // we should log them out here and redirect to home to double check
      deleteCookie(c, "tealSession");
      c.redirect("/");
      throw new Error("No DID found in session");
    }
    return session.session.replace(/['"]/g, "");
  }
}

export async function getSessionAgent(c: TealContext) {
  const did = await getContextDID(c);

  if (did != undefined) {
    const oauthsession = await atclient.restore(did);
    const agent = new Agent(oauthsession);
    if (!agent) {
      return null;
    }
    return agent;
  }
}