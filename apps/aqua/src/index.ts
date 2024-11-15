import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@teal/db/connect";
import { tealSession } from "@teal/db/schema";
import { getAuthRouter, loginGet } from "./auth/router";
import pino from "pino";
import { EnvWithCtx, setupContext } from "./ctx";
import { env } from "./lib/env";
import { Agent } from "@atproto/api";
import { getCookie } from "hono/cookie";
import { getSession } from "./lib/auth";

const logger = pino({ name: "server start" });

const app = new Hono<EnvWithCtx>();

app.use((c, next) => setupContext(c, db, logger, next));

app.get("/", async (c) => {
  const cookies = getCookie(c, "tealSession");
  const sessCookie = cookies?.split("teal:")[1];
  console.log(`sess-id: ${sessCookie}`);

  if (sessCookie != undefined) {
    const session = await getSession(c);
    console.log(session);
    if (session != undefined) {
      const sessionString = JSON.stringify(session, null, 2);
      console.log(
        `sessions: ${sessionString} | session did: ${session.session}`,
      );
    }
    const agent = new Agent(session);
    // console.log(agent);
    return agent.getFollowers({ actor: agent.did });
  }
  return c.text("Hono meets Node.js");
});

app.get("/client-metadata.json", (c) => {
  return c.json(atclient.clientMetadata);
});

app.get("/info", async (c) => {
  const result = await db.query.status.findFirst().execute();
  console.log("result", result);
  return c.json(result);
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
