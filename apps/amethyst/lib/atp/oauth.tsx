import Constants from "expo-constants";
import { ExpoOAuthClient, clientMetadataSchema } from "@atproto/oauth-client-expo";
import { nativeRedirectUri } from "@teal/client/atp/nativeOAuth";

const OAUTH_SCOPE = "atproto transition:generic";

/** The teal origin the app signs in through and reads from. */
export const APP_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || "http://localhost:8081";

export type AquareumOAuthClient = ExpoOAuthClient;

/** True when the app talks to a local dev stack rather than a public origin. */
function isLoopback(baseUrl: URL) {
  return baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1";
}

/**
 * Where sign-in returns to. A public origin uses the native client served at
 * `${origin}/android-client-metadata.json`, which redirects to the reversed-host
 * custom scheme registered in app.config.js. A local stack uses an AT Protocol
 * loopback client instead.
 */
export function oauthRedirectUri(baseUrl: string) {
  const url = new URL(baseUrl);

  if (!isLoopback(url)) return nativeRedirectUri(url.origin);

  const scheme = Constants.expoConfig?.scheme;
  const appScheme = Array.isArray(scheme) ? scheme[0] : scheme;

  if (!appScheme) throw new Error("unable to resolve scheme for oauth redirect");

  return `http://127.0.0.1${url.port ? `:${url.port}` : ""}/app-return/${appScheme}`;
}

export default function createOAuthClient(baseUrl: string, pdsBaseUrl: string): AquareumOAuthClient {
  if (!baseUrl) throw new Error("baseUrl is required");

  const url = new URL(baseUrl);
  const redirect = oauthRedirectUri(baseUrl);
  const loopbackParams = new URLSearchParams({ scope: OAUTH_SCOPE, redirect_uri: redirect });

  // Parsing checks the metadata and types the redirect URI as a URI.
  const meta = clientMetadataSchema.parse({
    client_id: isLoopback(url)
      ? `http://localhost?${loopbackParams.toString()}`
      : `${url.origin}/android-client-metadata.json`,
    redirect_uris: [redirect],
    scope: OAUTH_SCOPE,
    token_endpoint_auth_method: "none",
    client_name: "teal",
    client_uri: isLoopback(url) ? undefined : url.origin,
    response_types: ["code"],
    grant_types: ["authorization_code", "refresh_token"],
    application_type: "native",
    dpop_bound_access_tokens: true,
  });

  return new ExpoOAuthClient({
    handleResolver: "https://" + pdsBaseUrl, // backend instances should use a DNS based resolver
    responseMode: "query",
    // Must match the document served at client_id (loopback clients have none).
    clientMetadata: meta,
  });
}
