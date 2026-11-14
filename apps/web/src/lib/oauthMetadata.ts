import type { OAuthClientMetadataInput } from "@atproto/oauth-client-browser";

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
