import type { OAuthClientMetadataInput } from "@atproto/oauth-client-browser";
import { nativeRedirectUri } from "@teal/client/atp/nativeOAuth";

export const OAUTH_SCOPE = "atproto transition:generic";

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

/** Client metadata for a native app whose client_id is `${origin}${documentPath}`. */
function nativeClientMetadataFor(origin: string, documentPath: string): OAuthClientMetadataInput {
  return {
    client_id: `${origin}${documentPath}`,
    client_name: "teal",
    client_uri: origin,
    redirect_uris: [nativeRedirectUri(origin)],
    response_types: ["code"],
    grant_types: ["authorization_code", "refresh_token"],
    scope: OAUTH_SCOPE,
    token_endpoint_auth_method: "none",
    application_type: "native",
    dpop_bound_access_tokens: true,
  };
}

/** The native iOS app's client metadata, served at /ios-client-metadata.json. */
export function iosClientMetadataFor(origin: string) {
  return nativeClientMetadataFor(origin, "/ios-client-metadata.json");
}

/** The Android app's client metadata, served at /android-client-metadata.json. */
export function androidClientMetadataFor(origin: string) {
  return nativeClientMetadataFor(origin, "/android-client-metadata.json");
}
