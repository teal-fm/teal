import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { db } from "@teal/db/connect";
import { getAuthRouter } from "./auth/router";
import pino from "pino";
import { EnvWithCtx, setupContext, TealContext } from "./ctx";
import { env } from "./lib/env";
import { getCookie } from "hono/cookie";
import { atclient } from "./auth/client";
import { getContextDID, getSessionAgent, getUserInfo } from "./lib/auth";

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

  // Serve logged in content
  if (sessCookie != undefined) {
    const session = await getContextDID(c);

    if (session != undefined) {
      const profile = await getUserInfo(c);
      // const agent = await getSessionAgent(c);
      // const followers = await agent?.getFollowers();
      return c.html(
        `<div id="root">
          <div id="header">
            <h1>teal.fm</h1>
            <p>Your music, beautifully tracked. (soon.)</p>
          </div>
          <div class="container">
            <h1>${profile?.handle}</h1>
          </div>
        </div>`
      );
    }
  }

  // Serve non-logged in content
  return c.html(
    `<div id="root">
    <div id="header">
      <h1>teal.fm</h1>
      <p>Your music, beautifully tracked. (soon.)</p>
    </div>
    <div class="container">
      <button><a href="/login">Login</a></button>
      <div class="signup-cta">
        Don't have an account on the Atmosphere?
        <a href="https://bsky.app">Sign up for Bluesky</a> to create one now!
      </div>
    </div>
  </div>`
  );
});

app.get("/login", (c) => {
  return c.html(
    `<div id="root">
    <div id="header">
      <h1>teal.fm</h1>
      <p>Your music, beautifully tracked. (soon.)</p>
    </div>
    <div class="container">
      <form action="/login" method="post" class="login-form">
        <input
          type="text"
          name="handle"
          placeholder="Enter your handle (eg alice.bsky.social)"
          required
        />
        <button type="submit">Log in</button>
      </form>
      <div class="signup-cta">
        Don't have an account on the Atmosphere?
        <a href="https://bsky.app">Sign up for Bluesky</a> to create one now!
      </div>
    </div>
  </div>`
  );
});

app.post("/login", async (c: TealContext) => {
  const body = await c.req.parseBody();
  const { handle } = body;  
  console.log("handle", handle);
  // Initiate the OAuth flow
  try {
    console.log("Calling authorize");
    if (typeof handle === "string") {
      const url = await atclient.authorize(handle, {
        scope: "atproto transition:generic",
      });
      console.log("Redirecting to oauth login page");
      console.log(url);
      return Response.redirect(url);
    }
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not authorize user" });
  }
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
