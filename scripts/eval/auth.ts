/**
 * Last.fm OAuth authentication for the evaluation harness.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const SCRIPT_DIR =
  import.meta.dirname ?? new URL(".", import.meta.url).pathname;
export const SESSION_KEY_FILE = join(SCRIPT_DIR, ".lastfm_session_key");

/**
 * Generate Last.fm API signature.
 * Signature is MD5 of: sorted parameter keys + values + API secret.
 * api_sig and format are excluded from signature calculation (per Last.fm API docs).
 */
export async function generateSignature(
  params: Record<string, string>,
  apiSecret: string,
): Promise<string> {
  const crypto = await import("crypto");
  const paramsForSig: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key !== "api_sig" && key !== "format") {
      paramsForSig[key] = value;
    }
  }

  const sortedKeys = Object.keys(paramsForSig).sort();
  const sigString =
    sortedKeys.map((key) => `${key}${paramsForSig[key]}`).join("") + apiSecret;

  return crypto.createHash("md5").update(sigString).digest("hex");
}

/**
 * Get Last.fm session key via OAuth.
 * Returns a cached session key if valid, otherwise initiates a new OAuth flow.
 */
export async function getLastFMSession(
  apiKey: string,
  apiSecret: string,
): Promise<string> {
  // Try to load existing session key
  if (existsSync(SESSION_KEY_FILE)) {
    const sessionKey = readFileSync(SESSION_KEY_FILE, "utf-8").trim();
    if (sessionKey) {
      try {
        const testParams: Record<string, string> = {
          method: "user.getInfo",
          api_key: apiKey,
          sk: sessionKey,
          format: "json",
        };
        const testSig = await generateSignature(testParams, apiSecret);
        testParams.api_sig = testSig;
        const testUrl = `https://ws.audioscrobbler.com/2.0/?${new URLSearchParams(testParams).toString()}`;
        const testRes = await fetch(testUrl);
        if (testRes.ok) {
          const data = await testRes.json();
          if (data.user && !data.error) {
            console.log(
              `Using existing session key (authenticated as: ${data.user.name})`,
            );
            console.log(
              `(To force re-authentication, delete ${SESSION_KEY_FILE})\n`,
            );
            return sessionKey;
          }
        }
      } catch (e: unknown) {
        console.log(`Existing session key invalid: ${e instanceof Error ? e.message : String(e)}`);
        console.log("Starting new OAuth flow...\n");
      }
    }
  }

  // OAuth flow
  console.log("\n=== Last.fm OAuth Authentication ===");
  console.log("Step 1: Getting authentication token...");

  const tokenUrl = `https://ws.audioscrobbler.com/2.0/?method=auth.getToken&api_key=${apiKey}&format=json`;
  console.log(`  Fetching token from Last.fm API...`);
  console.log(`  API Key: ${apiKey.substring(0, 8)}...`);

  const tokenRes = await fetch(tokenUrl);
  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(
      `Failed to get token: ${tokenRes.statusText} - ${errorText}`,
    );
  }

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    throw new Error(
      `Last.fm API error: ${tokenData.error} - ${tokenData.message || "Invalid API key or credentials"}`,
    );
  }

  const token = tokenData.token;
  if (!token) {
    throw new Error(
      `No token received from Last.fm API. Response: ${JSON.stringify(tokenData)}`,
    );
  }

  console.log(`  Got token: ${token.substring(0, 10)}...`);

  // Step 2: User authorizes
  const authUrl = `https://www.last.fm/api/auth?api_key=${apiKey}&token=${token}`;
  console.log(`\nStep 2: Opening browser for authorization...`);
  console.log(`  URL: ${authUrl}`);
  console.log(`\n  Instructions:`);
  console.log(`  1. A browser window should open automatically`);
  console.log(`  2. Log in to Last.fm if needed`);
  console.log(`  3. Click "Allow access" to authorize this application`);
  console.log(
    `  4. The script will automatically detect when you've authorized\n`,
  );

  const { spawn } = await import("child_process");
  const platform = process.platform;
  let browserOpened = false;

  try {
    if (platform === "darwin") {
      spawn("open", [authUrl], { detached: true, stdio: "ignore" }).unref();
      browserOpened = true;
    } else if (platform === "linux") {
      spawn("xdg-open", [authUrl], {
        detached: true,
        stdio: "ignore",
      }).unref();
      browserOpened = true;
    } else if (platform === "win32") {
      spawn("cmd", ["/c", "start", authUrl], {
        detached: true,
        stdio: "ignore",
      }).unref();
      browserOpened = true;
    } else {
      console.log(
        `  Platform ${platform} not supported for auto-opening browser.`,
      );
      console.log(`  Please manually visit: ${authUrl}\n`);
    }
    if (browserOpened) console.log(`  Browser opened successfully\n`);
  } catch (e: unknown) {
    console.error(`  Error opening browser: ${e instanceof Error ? e.message : String(e)}`);
    console.error(`  Please manually visit: ${authUrl}\n`);
  }

  if (browserOpened) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("Step 3: Waiting for authorization...");
  console.log("  (Polling Last.fm API every 2 seconds)\n");

  // Step 3: Poll for session
  const maxWait = 300000; // 5 minutes
  const startTime = Date.now();
  const pollInterval = 2000;
  let pollCount = 0;

  while (Date.now() - startTime < maxWait) {
    pollCount++;
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const sig = await generateSignature(
      { method: "auth.getSession", token, api_key: apiKey },
      apiSecret,
    );
    const sessionUrl = `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${sig}&format=json`;

    if (pollCount % 5 === 0) {
      console.log(`  Poll #${pollCount}: Checking for authorization...`);
    }

    try {
      const sessionRes = await fetch(sessionUrl);
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData.session?.key) {
          const sessionKey = sessionData.session.key;
          writeFileSync(SESSION_KEY_FILE, sessionKey);
          console.log(
            `  Authorization received! (after ${pollCount} polls)`,
          );
          console.log(`  Session key saved to ${SESSION_KEY_FILE}\n`);
          return sessionKey;
        } else if (sessionData.error && pollCount === 1) {
          console.log(`  (Waiting for user to authorize in browser...)`);
        }
      } else if (pollCount === 1) {
        console.log(
          `  API returned ${sessionRes.status}, waiting for authorization...`,
        );
      }
    } catch (e: unknown) {
      if (pollCount === 1) {
        console.log(`  Error on first poll (expected): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed > 0 && elapsed % 10 === 0) {
      console.log(
        `  Still waiting... (${elapsed}s elapsed, ${pollCount} polls)`,
      );
    }
  }

  throw new Error(
    `OAuth timeout: No authorization received after ${Math.floor(maxWait / 1000)} seconds`,
  );
}
