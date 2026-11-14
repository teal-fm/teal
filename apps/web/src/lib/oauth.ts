import {
  atprotoLoopbackClientMetadata,
  BrowserOAuthClient,
  type OAuthClientMetadataInput,
} from "@atproto/oauth-client-browser";

export const OAUTH_SCOPE = "atproto transition:generic";

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;

/**
 * The client metadata served at /client-metadata.json for a public origin.
 * The server route and the browser client build it from the same function.
 */
export function clientMetadataFor(origin: string): OAuthClientMetadataInput {
  return {
    client_id: `${origin}/client-metadata.json`,
    client_name: "teal",
    client_uri: origin,
    redirect_uris: [`${origin}/auth/callback`],
    response_types: ["code"],
    grant_types: ["authorization_code", "refresh_token"],
    scope: OAUTH_SCOPE,
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  };
}

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
