import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import pino from "pino";

import { db } from "@teal/db/connect";

import { EnvWithCtx, setupContext, TealContext } from "./ctx";
import { createDidWeb } from "./did/web";
import { env } from "./lib/env";
import { getXrpcRouter } from "./xrpc/route";

const logger = pino({ name: "server start" });

const app = new Hono<EnvWithCtx>();

app.use((c, next) => setupContext(c, db, logger, next));

const HOME_TEXT = `

         █████
      ███     ███
    ██    ▐▌     ██        ██▌
   █      ██       █      ▐█ █▌
  █     ███████     █     ██
  █       ██        █    ▐█     ▐▄▄▄   ▄▄▄
  █       ██        █    ▐█    ▐█▌ ██ █▌ ██
  █       ██        █  █████   █▌   ▐█▌   ▐█
   █      ██  █    ██    █▌   ▐█    ▐█    ▐█
    ██     ███   █████   █▌   █▌    █▌    █▌▐
      ███     █████■██  ██    █     █     ▐█▀
         █████    ███   █▌
                    ▐█ █▌
                     ▐██

You have reached 'aqua', an AT Protocol Application View (AppView)
for the 'teal.fm' application.

Most API routes are under /xrpc/

    Code: <a href="https://github.com/teal-fm/teal">github.com/teal-fm/teal</a>
Protocol: <a href="https://atproto.com">atproto.com</a>

Visit <a href="https://docs.teal.fm">docs.teal.fm</a> for more information.`;

const HOME_STYLES = `
  body {
    background-color: #000;
    color: #ddd;
  }
  a {
    color: #aaf;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
`;

app.get("/", (c) =>
  c.html(
    `<html><head><style>${HOME_STYLES}</style></head><body><pre>${HOME_TEXT}</pre></body></html>`,
  ),
);

app.route("/xrpc", getXrpcRouter());

app.get("/.well-known/did.json", (c) =>
  // assume public url is https!
  c.json(createDidWeb(env.PUBLIC_URL.split("://")[1], env.DID_WEB_PUBKEY)),
);

app.use("/*", serveStatic({ root: "/public" }));

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
              ? `http://${env.HOST}`
              : // TODO: below should probably be https://
                // but i just want to ctrl click in the terminal
                "http://" + info.address
          }:${info.port} (${info.family})`,
        );
      },
    );
  }
};

run();

export default app;
