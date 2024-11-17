import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { db } from "@teal/db/connect";
import { getAuthRouter } from "./auth/router";
import pino from "pino";
import { EnvWithCtx, setupContext, TealContext } from "./ctx";
import { env } from "./lib/env";
import { getCookie, deleteCookie } from "hono/cookie";
import { atclient } from "./auth/client";
import { getSessionAgent} from "./lib/auth";
import { RichText, } from "@atproto/api";

const logger = pino({ name: "server start" });

const app = new Hono<EnvWithCtx>();

app.use((c, next) => setupContext(c, db, logger, next));

app.route("/oauth", getAuthRouter());

app.get("/client-metadata.json", (c) => {
  return c.json(atclient.clientMetadata);
});

app.get("/", async (c) => {
  const tealSession = getCookie(c, "tealSession");

  // Serve logged in content
  if (tealSession) {
    const agent = await getSessionAgent(c);
      
    const post = await agent?.getPost({repo: "teal.fm", rkey: "3lb2c74v73c2a"});
    // const followers = await agent?.getFollowers();
    return c.html(
      `<div id="root">
        <div id="header">
          <h1>teal.fm</h1>
          <p>Your music, beautifully tracked. (soon.)</p>
        </div>
        <div class="container">
          <h1>${post?.value.text}</h1>
          <button><a href="/stamp">stamp</a></button>
        </div>
        <form action="/logout" method="post" class="session-form">
          <button type="submit">Log out</button>
        </form>
      </div>`
    );
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

app.post("/logout", (c) => {
  deleteCookie(c, "tealSession");
  // TODO: delete session record from db??
  return c.redirect("/");
});

app.get("/stamp", (c) => {
  return c.html(
    `<div id="root">
    <div id="header">
      <h1>teal.fm</h1>
      <p>Your music, beautifully tracked. (soon.)</p>
    </div>
    <div class="container">
      <p>want to share what you're listening to in the meantime??</p>
      <form action="/stamp" method="post" class="login-form">
        <input
          type="text"
          name="artist"
          placeholder="artist name (eg blink-182)"
          required
        />
        <input
          type="text"
          name="track"
          placeholder="track title (eg what's my age again?)"
          required
        />
        <input 
          type="text"
          name="link"
          placeholder="https://www.youtube.com/watch?v=K7l5ZeVVoCA&pp=ygUdYmxpbmsgMTgyIHdoYXQncyBteSBhZ2UgYWdhaW4%3D"
        />
        <button type="submit">Stamp!</button>
      </form>
      <div class="signup-cta">
        Don't have an account on the Atmosphere?
        <a href="https://bsky.app">Sign up for Bluesky</a> to create one now!
      </div>
    </div>
  </div>`
  );
});


app.post("/stamp", async (c: TealContext) => {
  const body = await c.req.parseBody();
  const { artist, track, link } = body;
  const agent = await getSessionAgent(c);

  if (agent) {
    const rt = new RichText({text: `now playing: 
    artist: ${artist}
    track: ${track}

    powered by @teal.fm`});
    await rt.detectFacets(agent);
      
    let embed = undefined;
    if (link) {
      embed = {
        $type: "app.bsky.embed.external",
        external: {
          uri: link,
          title: track,
          description: `${artist} - ${track}`
        }
      }; 
    }
    const post = await agent.post({
      text: rt.text, 
      facets: rt.facets, 
      embed: embed
    });

    console.log(`post: ${post}`)

    return c.json(post);
  }
  return c.html(`<h1>well this is awkward... </h1>`)
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
