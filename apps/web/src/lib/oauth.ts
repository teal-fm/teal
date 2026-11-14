import { atprotoLoopbackClientMetadata, BrowserOAuthClient } from "@atproto/oauth-client-browser";

import { clientMetadataFor, OAUTH_SCOPE } from "./oauthMetadata";

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;

/**
 * On localhost the client is a loopback client: no metadata document, and the
 * callback must use 127.0.0.1, so sign-in from localhost finishes there.
 */
function metadataForPage(location: Location) {
  if (!LOOPBACK.test(location.hostname)) return clientMetadataFor(location.origin);
  const port = location.port ? `:${location.port}` : "";
  const query = new URLSearchParams({
    redirect_uri: `http://127.0.0.1${port}/auth/callback`,
    scope: OAUTH_SCOPE,
  });
  return atprotoLoopbackClientMetadata(`http://localhost?${query}`);
}

let client: BrowserOAuthClient | undefined;
const deleted = new Set<(sub: string) => void>();

/** Called when a session is revoked or can no longer refresh. */
export function onSessionDeleted(listener: (sub: string) => void) {
  deleted.add(listener);
  return () => deleted.delete(listener);
}

/** One client per page: it owns the IndexedDB session store. Browser only. */
export function oauthClient() {
  client ??= new BrowserOAuthClient({
    clientMetadata: metadataForPage(window.location),
    handleResolver: "https://public.api.bsky.app",
    responseMode: "query",
    onSessionDeleted: (sub) => {
      for (const listener of deleted) listener(sub);
    },
  });
  return client;
}
