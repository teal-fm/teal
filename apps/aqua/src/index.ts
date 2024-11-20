import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { db } from "@teal/db/connect";
import { getAuthRouter } from "./auth/router";
import pino from "pino";
import { EnvWithCtx, setupContext, TealContext } from "./ctx";
import { env } from "./lib/env";
import { getCookie, deleteCookie } from "hono/cookie";
import { atclient } from "./auth/client";
import { getSessionAgent } from "./lib/auth";
import { RichText } from "@atproto/api";
import { sanitizeUrl } from "@braintree/sanitize-url";
import { resolveLink } from "./lib/api/resolve"

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

    const post = await agent?.getPost({
      repo: "teal.fm",
      rkey: "3lb2c74v73c2a",
    });
    // const followers = await agent?.getFollowers();
    return c.html(
      `
      <head>
      <link rel="stylesheet" href="https://latex.vercel.app/style.css">
      </head>
      <div id="root">
        <div id="header" style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
          <div>
            <h1>teal.fm</h1>
            <p>Your music, beautifully tracked. (soon.)</p>
          </div>
          <div style=" width: 100%; display: flex; flex-direction: row; justify-content: space-between; gap: 0.5rem;">
            <div>
              <a href="/">home</a>
              <a href="/stamp">stamp</a>
            </div>
            <a href="/logout" style="color: red;">logout</a>
          </div>
        </div>
        <div class="container">
          <h2>${post?.value.text}</h2>
        </div>
      </div>`,
    );
  }

  // Serve non-logged in content
  return c.html(
    `
    <head>
    <link rel="stylesheet" href="https://latex.vercel.app/style.css">
    </head>
    <div id="root">
    <div id="header">
      <h1>teal.fm</h1>
      <p>Your music, beautifully tracked. (soon.)</p>
      <div style=" width: 100%; display: flex; flex-direction: row; justify-content: space-between; gap: 0.5rem;">
        <div>
          <a href="/">home</a>
          <a href="/stamp">stamp</a>
        </div>
        <div/>
      </div>
    </div>
    <div class="container">
      <button><a href="/login">Login</a></button>
      <div class="signup-cta">
        Don't have an account on the Atmosphere?
        <a href="https://bsky.app">Sign up for Bluesky</a> to create one now!
      </div>
    </div>
  </div>`,
  );
});

app.get("/login", (c) => {
  const tealSession = getCookie(c, "tealSession");

  return c.html(
    `
    <head>
    <link rel="stylesheet" href="https://latex.vercel.app/style.css">
    </head>
    <div id="root">
    <div id="header">
      <h1>teal.fm</h1>
      <p>Your music, beautifully tracked. (soon.)</p>
      <div style=" width: 100%; display: flex; flex-direction: row; justify-content: space-between; gap: 0.5rem;">
        <div>
          <a href="/">home</a>
          <a href="/stamp">stamp</a>
        </div>
        <div />
      </div>
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
  </div>`,
  );
});

app.post("/login", async (c: TealContext) => {
  const body = await c.req.parseBody();
  let { handle } = body;
  // shouldn't be a file, escape now
  if (handle instanceof File) return c.redirect("/login");
  handle = sanitizeUrl(handle);
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
  // check logged in
  const tealSession = getCookie(c, "tealSession");
  if (!tealSession) {
    return c.redirect("/login");
  }
  return c.html(
    `
    <head>
    <link rel="stylesheet" href="https://latex.vercel.app/style.css">
    </head>
    <div id="root">
    <div id="header">
      <h1>teal.fm</h1>
      <p>Your music, beautifully tracked. (soon.)</p>
      <div style=" width: 100%; display: flex; flex-direction: row; justify-content: space-between; gap: 0.5rem;">
        <div>
          <a href="/">home</a>
          <a href="/stamp">stamp</a>
        </div>
        <form action="/logout" method="post" class="session-form">
          <button type="submit" style="background-color: #cc0000; color: white; border: none; padding: 0rem 0.5rem; border-radius: 0.5rem;">logout</button>
        </form>
      </div>
    </div>
    <div class="container">
      <p>want to share what you're listening to in the meantime??</p>
      <form action="/stamp" method="post" class="login-form" style="display: flex; flex-direction: column; gap: 0.5rem;">
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
        <button type="submit" style="width: 15%">Stamp!</button>
      </form>
      <div class="signup-cta">
        Don't have an account on the Atmosphere?
        <a href="https://bsky.app">Sign up for Bluesky</a> to create one now!
      </div>
    </div>
  </div>`,
  );
});

app.post("/stamp", async (c: TealContext) => {
  const body = await c.req.parseBody();
  let { artist, track, link } = body;
  // shouldn't get a File, escape now
  if (artist instanceof File || track instanceof File || link instanceof File) return c.redirect("/stamp");
  
  artist = sanitizeUrl(artist);
  track = sanitizeUrl(track);
  link = sanitizeUrl(link);

  const agent = await getSessionAgent(c);

  if (agent) {
    const rt = new RichText({
      text: `now playing:
    artist: ${artist}
    track: ${track}

    powered by @teal.fm`,
    });
    await rt.detectFacets(agent);

    let embed = undefined;
    if (link) {
      const temp = await resolveLink(link);
      if (temp) {
        embed = {
          $type: "app.bsky.embed.external",
          external: {
            uri: temp.uri,
            title: temp.title,
            description: temp.description,
            thumb: temp.thumb,
          },
        }; 
      } else {
        embed = {
          $type: "app.bsky.embed.external",
          external: {
            uri: link,
            title: track,
            description: `${artist} - ${track}`,
          },
        };
      }
    }
    // uncomment below to post to bsky
    // const post = await agent.post({
    //   text: rt.text,
    //   facets: rt.facets,
    //   embed: embed,
    // });

    console.log(`post: ${JSON.stringify(embed, null, 2)}`);

    return c.html(
      `
      <head>
      <link rel="stylesheet" href="https://latex.vercel.app/style.css">
      </head>
      <div id="root">
      <div id="header">
        <h1>teal.fm</h1>
        <p>Your music, beautifully tracked. (soon.)</p>
        <div style=" width: 100%; display: flex; flex-direction: row; justify-content: space-between; gap: 0.5rem;">
          <div>
            <a href="/">home</a>
            <a href="/stamp">stamp</a>
          </div>
          <form action="/logout" method="post" class="session-form">
            <button type="submit" style="background-color: #cc0000; color: white; border: none; padding: 0rem 0.5rem; border-radius: 0.5rem;">logout</button>
          </form>
        </div>
      </div>
      <div class="container">
        <h2 class="stamp-success">Success! 🎉</h2>
        <p>Your post is being tracked by the Atmosphere.</p>
        
      </div>
    </div>`,
    );

    // <p>You can view it <a href="https://bsky.app/profile/${agent.did}/post/${post.uri.split("/").pop()}">here</a>.</p>
  }
  return c.html(`<h1>doesn't look like you're logged in... try <a href="/login">logging in?</a></h1>`);
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
