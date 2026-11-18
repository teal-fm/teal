/** OAuth details shared by the client metadata route and the browser client. */

export const PLAY_COLLECTIONS = ["fm.teal.feed.play", "fm.teal.alpha.feed.play"];

/** Signing in asks a PDS for writes to the play collections and nothing else. */
export const SCOPES = [
  "atproto",
  ...PLAY_COLLECTIONS.map((collection) => `repo:${collection}`),
].join(" ");

export const CALLBACK_PATH = "/oauth/callback";
export const METADATA_PATH = "/oauth-client-metadata.json";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const isLoopback = (location: { hostname: string }) =>
  LOOPBACK.has(location.hostname);

/**
 * The client ID and redirect for an origin. Locally that's an atproto loopback
 * client, which needs no published metadata but must redirect to 127.0.0.1.
 */
export function oauthClient(location: {
  origin: string;
  hostname: string;
  port: string;
}) {
  if (!isLoopback(location)) {
    return {
      clientId: `${location.origin}${METADATA_PATH}`,
      redirectUri: `${location.origin}${CALLBACK_PATH}`,
    };
  }
  const port = location.port ? `:${location.port}` : "";
  const redirectUri = `http://127.0.0.1${port}${CALLBACK_PATH}`;
  const query = new URLSearchParams({
    redirect_uri: redirectUri,
    scope: SCOPES,
  });

  return { clientId: `http://localhost?${query}`, redirectUri };
}

/** The metadata document a PDS fetches from `clientId` outside loopback. */
export function clientMetadata(origin: string) {
  const { clientId, redirectUri } = oauthClient(new URL(origin));

  return {
    client_id: clientId,
    client_name: "teal.fm",
    client_uri: origin,
    logo_uri: `${origin}/favicon.ico`,
    redirect_uris: [redirectUri],
    scope: SCOPES,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "none",
    dpop_bound_access_tokens: true,
  };
}
