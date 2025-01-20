import {
  ClientMetadata,
  clientMetadataSchema,
  ReactNativeOAuthClient,
} from "@aquareum/atproto-oauth-client-react-native";
import Constants from "expo-constants";
import { Platform } from "react-native";

export type AquareumOAuthClient = Omit<
  ReactNativeOAuthClient,
  "keyset" | "serverFactory" | "jwks"
>;

export default function createOAuthClient(
  baseUrl: string
): AquareumOAuthClient {
  if (!baseUrl) {
    throw new Error("baseUrl is required");
  }
  let meta: ClientMetadata;

  const isWeb = Platform.OS === "web";
  const u = new URL(baseUrl);
  let hostname = u.hostname;
  if (hostname == "localhost") {
    hostname = "127.0.0.1";
  }
  let redirect = `${u.protocol}//${hostname}`;
  if (u.port !== "") {
    redirect = `${redirect}:${u.port}`;
  }
  if (isWeb) {
    redirect = `${redirect}/auth/callback`;
  } else {
    const scheme = Constants.expoConfig?.scheme;
    if (!scheme) {
      throw new Error("unable to resolve scheme for oauth redirect");
    }
    redirect = `${redirect}/app-return/${scheme}`;
  }
  const queryParams = new URLSearchParams();
  queryParams.set("scope", "atproto transition:generic");
  queryParams.set("redirect_uri", redirect);
  console.log("Our client base uri is ", hostname);
  meta = {
    client_id:
      hostname === "127.0.0.1"
        ? `http://localhost?${queryParams.toString()}`
        : `https://${hostname}/client-metadata.json`,
    redirect_uris: [redirect as any],
    scope: "atproto transition:generic",
    token_endpoint_auth_method: "none",
    client_name: "Amethyst",
    response_types: ["code"],
    grant_types: ["authorization_code", "refresh_token"],
    // > There is a special exception for the localhost development workflow [ ... ]
    // > These clients use web URLs, but have application_type set to native in the generated client metadata.
    application_type: hostname === "localhost" ? "native" : "web",
    dpop_bound_access_tokens: true,
  };
  clientMetadataSchema.parse(meta);
  return new ReactNativeOAuthClient({
    handleResolver: "https://bsky.social", // backend instances should use a DNS based resolver
    responseMode: "query", // or "fragment" (frontend only) or "form_post" (backend only)

    // These must be the same metadata as the one exposed on the
    // "client_id" endpoint (except when using a loopback client)
    clientMetadata: meta,
  });
}
