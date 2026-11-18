/**
 * Pushes the site's lexicons and query scripts to a HappyView instance.
 *
 *   HAPPYVIEW_ADMIN_KEY=hv_... node happyview/sync.ts            # lexicons + scripts
 *   ... node happyview/sync.ts --no-backfill                       # skip the network backfill
 *   ... node happyview/sync.ts backfill alice.bsky.social bob.com  # backfill just these accounts
 *   ... node happyview/sync.ts client https://teal.fm              # create the site's API client
 *   ... node happyview/sync.ts login-client https://teal.fm        # create the sign-in client
 *
 * HAPPYVIEW_URL defaults to the local compose stack.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = import.meta.dirname;
const baseUrl = (process.env.HAPPYVIEW_URL ?? "http://127.0.0.1:3010").replace(
  /\/$/,
  "",
);
const adminKey = process.env.HAPPYVIEW_ADMIN_KEY;

const PLAY_COLLECTIONS = ["fm.teal.feed.play", "fm.teal.alpha.feed.play"];
const PROCEDURES = new Set(["fm.teal.site.updatePlay", "fm.teal.site.deletePlay"]);
/** What signing in asks of a PDS: writes to the play collections and nothing else. */
const SCOPES = ["atproto", ...PLAY_COLLECTIONS.map((c) => `repo:${c}`)].join(" ");

async function admin(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}/admin${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${method} /admin${path}: ${response.status} ${text}`);

  return text ? JSON.parse(text) : undefined;
}

async function syncLexicons(backfill: boolean) {
  const dir = join(root, "lexicons");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
  const lexicons = await Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(join(dir, file), "utf8")),
    ),
  );
  // Defs before the records and queries that reference them.
  lexicons.sort(
    (a, b) => Number(!a.id.endsWith(".defs")) - Number(!b.id.endsWith(".defs")),
  );

  for (const lexicon of lexicons) {
    const type = lexicon.defs.main?.type;
    const result = await admin("POST", "/lexicons", {
      lexicon_json: lexicon,
      backfill: type === "record" && backfill,
      target_collection:
        type === "query" || type === "procedure" ? PLAY_COLLECTIONS[0] : undefined,
    });
    const job = result?.backfill_job_id
      ? ` (backfill ${result.backfill_job_id})`
      : "";
    console.log(`lexicon ${lexicon.id} r${result?.revision ?? "?"}${job}`);
  }
}

async function syncScripts() {
  const dir = join(root, "scripts");
  const prelude = await readFile(join(dir, "prelude.lua"), "utf8");
  const files = (await readdir(dir)).filter(
    (file) => file.endsWith(".lua") && file !== "prelude.lua",
  );

  for (const file of files) {
    const body = `${prelude}\n${await readFile(join(dir, file), "utf8")}`;
    // play.lua indexes both play collections; every other script serves the
    // query or procedure it's named after.
    const nsid = file.replace(/\.lua$/, "");
    const triggers =
      file === "play.lua"
        ? PLAY_COLLECTIONS.map((collection) => `record.index:${collection}`)
        : [`${PROCEDURES.has(nsid) ? "xrpc.procedure" : "xrpc.query"}:${nsid}`];
    for (const id of triggers) {
      await admin("POST", "/scripts", { id, body });
      console.log(`script ${id}`);
    }
  }
}

async function main() {
  if (!adminKey)
    throw new Error("Set HAPPYVIEW_ADMIN_KEY to a HappyView API key (hv_...).");

  const [command, ...rest] = process.argv.slice(2);
  if (command === "backfill") {
    const dids = rest.flatMap((arg) => arg.split(/[\s,]+/)).filter(Boolean);
    const job = await admin("POST", "/backfill", { dids });
    console.log(
      `backfill ${job?.id ?? JSON.stringify(job)} for ${dids.length} accounts`,
    );
    return;
  }
  if (command === "client") {
    const origin = rest[0];
    if (!origin) throw new Error("Usage: sync.ts client <site origin>");
    // Confidential: only the site's server holds the secret, and every visitor's
    // request shares this one client's rate limit, so the bucket is generous.
    const client = await admin("POST", "/api-clients", {
      name: "teal.fm site",
      client_id_url: `${origin}/client-metadata.json`,
      client_uri: origin,
      redirect_uris: [`${origin}/oauth/callback`],
      client_type: "confidential",
      rate_limit_capacity: 5000,
      rate_limit_refill_rate: 500,
    });
    console.log(`HAPPYVIEW_CLIENT_KEY=${client.client_key}`);
    console.log(`HAPPYVIEW_CLIENT_SECRET=${client.client_secret}`);
    return;
  }

  if (command === "login-client") {
    const origin = rest[0]?.replace(/\/$/, "");
    if (!origin) throw new Error("Usage: sync.ts login-client <site origin>");
    const site = new URL(origin);
    // Public: sign-in and writes run in the browser, which can't keep a secret.
    // Locally the site is an atproto loopback client served from 127.0.0.1,
    // whose ID HappyView derives itself (see loopbackClientId in src/lib/oauth.ts).
    const loopback = ["localhost", "127.0.0.1"].includes(site.hostname);
    const browserOrigin = loopback
      ? `http://127.0.0.1${site.port ? `:${site.port}` : ""}`
      : origin;
    const client = await admin("POST", "/api-clients", {
      name: "teal.fm sign-in",
      client_id_url: loopback
        ? `http://localhost?${new URLSearchParams({ scope: SCOPES })}`
        : `${origin}/oauth-client-metadata.json`,
      client_uri: browserOrigin,
      redirect_uris: [
        loopback ? `${browserOrigin}/` : `${browserOrigin}/oauth/callback`,
      ],
      client_type: "public",
      allowed_origins: [browserOrigin],
      scopes: SCOPES,
    });
    console.log(`HAPPYVIEW_LOGIN_CLIENT_KEY=${client.client_key}`);
    return;
  }

  // Scripts first, so the backfill a new play lexicon starts already fills teal_plays.
  await syncScripts();
  await syncLexicons(!process.argv.includes("--no-backfill"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
