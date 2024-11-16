import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@teal/db/connect";
import { getAuthRouter, loginGet } from "./auth/router";
import pino from "pino";
import { EnvWithCtx, setupContext, TealContext } from "./ctx";
import { env } from "./lib/env";
import { Agent } from "@atproto/api";
import { getCookie } from "hono/cookie";
import { atclient } from "./auth/client";
import { tealSession } from "@teal/db/schema";

const logger = pino({ name: "server start" });

const app = new Hono<EnvWithCtx>();

export async function getSession(c: TealContext): Promise<string> {
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
      throw new Error("No DID found in session");
    }
    return session.session.replace(/['"]/g, "");
  }
}

app.use((c, next) => setupContext(c, db, logger, next));

app.get("/", async (c) => {
  const cookies = getCookie(c, "tealSession");
  const sessCookie = cookies?.split("teal:")[1];
  console.log(`sess-id: ${sessCookie}`);

  if (sessCookie != undefined) {
    const session = await getSession(c);

    if (session != undefined) {
      const oauthsession = await atclient.restore(session);
      console.log(oauthsession);
      const agent = new Agent(oauthsession);
      console.log(`agent: ${agent}`);
      if (agent.did) {
        return c.json(await agent.getProfile({ actor: agent.did }));
      }
    }
  }
  return c.text("teal-fm");
});

app.get("/client-metadata.json", (c) => {
  return c.json(atclient.clientMetadata);
});

app.route("/oauth", getAuthRouter());

const run = async () => {
  logger.info("Running in " + navigator.userAgent);
  if (navigator.userAgent.includes("Node")) {
    serve(
      {
        fetch: app.fetch,
        port: env.PORT,
        hostname: env.HOST,
      },
      (info) => {
        logger.info(
          `Listening on ${
            info.address == "::1"
              ? "http://localhost"
              : "http://" + info.address
          }:${info.port} (${info.family})`,
        );
      },
    );
  }
};

run();

export default app;
