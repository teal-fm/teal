import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { db } from "@teal/db/connect";
import { getAuthRouter } from "./auth/router";
import pino from "pino";
import { EnvWithCtx, setupContext,  } from "./ctx";
import { env } from "./lib/env";
import { getCookie } from "hono/cookie";
import { atclient } from "./auth/client";
import { getContextDID, getUserInfo } from "./lib/auth";

const logger = pino({ name: "server start" });

const app = new Hono<EnvWithCtx>();

app.use((c, next) => setupContext(c, db, logger, next));

app.route("/oauth", getAuthRouter());

app.get("/client-metadata.json", (c) => {
  return c.json(atclient.clientMetadata);
});

app.get("/", async (c) => {
  const cookies = getCookie(c, "tealSession");
  const sessCookie = cookies?.split("teal:")[1];

  if (sessCookie != undefined) {
    const session = await getContextDID(c);

    if (session != undefined) {
      return c.json(await getUserInfo(c));
    }
  }

  // Serve non-logged in content
  return c.text("teal-fm");
});
 
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
              // TODO: below should probably be https://
              // but i just want to ctrl click in the terminal
              : "http://" + info.address
          }:${info.port} (${info.family})`,
        );
      },
    );
  }
};

run();

export default app;
