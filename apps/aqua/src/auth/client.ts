import { NodeOAuthClient } from "@atproto/oauth-client-node";
import type { Database } from "@teal/db/connect";
import { env } from "@/lib/env";
import { SessionStore, StateStore } from "./storage";

import { db } from "@teal/db/connect";

const publicUrl = env.PUBLIC_URL;
const url = publicUrl || `http://127.0.0.1:${env.PORT}`;
const enc = encodeURIComponent;
export const atclient = new NodeOAuthClient({
  clientMetadata: {
    client_name: "teal",
    client_id: publicUrl
      ? `${url}/client-metadata.json`
      : `http://localhost?redirect_uri=${enc(`${url}/oauth/callback`)}&scope=${enc("atproto transition:generic")}`,
    client_uri: url,
    redirect_uris: [`${url}/oauth/callback`, `${url}/oauth/callback/app`],
    scope: "atproto transition:generic",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "none",
    dpop_bound_access_tokens: true,
  },
  stateStore: new StateStore(db),
  sessionStore: new SessionStore(db),
});
