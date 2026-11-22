import { latestOAuthCallback } from "../lib/atp/latestOAuthCallback";
import { resolveFromIdentity } from "@/lib/atp/pid";
import { Agent, type AppBskyActorDefs } from "@atproto/api";
import { OAuthSession } from "@atproto/oauth-client";

import * as Lexicons from "@teal/lexicons/src/lexicons";
import { OutputSchema as GetProfileOutputSchema } from "@teal/lexicons/src/types/fm/teal/actor/getProfile";

import createOAuthClient, { AquareumOAuthClient } from "../lib/atp/oauth";
import { StateCreator } from "./mainStore";

export interface AllProfileViews {
  bsky: null | AppBskyActorDefs.ProfileViewDetailed;
  teal: null | GetProfileOutputSchema["actor"];
  // todo: teal profile view
}

export interface AuthenticationSlice {
  auth: AquareumOAuthClient;
  status: "start" | "loggedIn" | "loggedOut";
  oauthState: null | string;
  oauthSession: null | OAuthSession;
  pdsAgent: null | Agent;
  isAgentReady: boolean;
  profiles: { [key: string]: AllProfileViews };
  client: null | AquareumOAuthClient;
  login: {
    loading: boolean;
    error: null | string;
  };
  pds: null | {
    url: string;
    loading: boolean;
    error: null | string;
  };
  getLoginUrl: (handle: string) => Promise<URL | null>;
  oauthCallback: (state: URLSearchParams) => Promise<void>;
  restorePdsAgent: () => void;
  logOut: () => void;
  populateLoggedInProfile: () => Promise<void>;
}

export const createAuthenticationSlice: StateCreator<AuthenticationSlice> = (
  set,
  get,
) => {
  // check if we have CF_PAGES_URL set. if not, use localhost
  const baseUrl = process.env.EXPO_PUBLIC_BASE_URL || "http://localhost:8081";
  console.log("Using base URL:", baseUrl);
  const initialAuth = createOAuthClient(baseUrl, "bsky.social");
  const failCallback = (error: unknown) => {
    if (get().status === "loggedIn") return;
    console.error("OAuth callback failed:", error);
    set({
      status: "loggedOut",
      login: {
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error during OAuth callback",
      },
    });
  };
  const callback = latestOAuthCallback(
    async (params) => {
      set({ login: { loading: true, error: null } });
      return initialAuth.callback(params);
    },
    ({ session, state }) => {
      if (get().status === "loggedIn") return;
      const agent = new Agent(session);
      set({
        // TODO: fork or update auth lib
        oauthSession: session as any,
        oauthState: state,
        status: "loggedIn",
        login: { loading: false, error: null },
        pdsAgent: addDocs(agent),
        isAgentReady: true,
      });
      get().populateLoggedInProfile();
    },
    failCallback,
  );

  console.log("Auth client created!");

  return {
    auth: initialAuth,
    status: "start",
    oauthState: null,
    oauthSession: null,
    pdsAgent: null,
    isAgentReady: false,
    profiles: {},
    client: null,
    login: {
      loading: false,
      error: null,
    },
    pds: null,

    getLoginUrl: async (handle: string) => {
      callback.cancel();
      set({ login: { loading: false, error: null } });
      try {
        // resolve the handle to a PDS URL
        const r = resolveFromIdentity(handle);
        let auth = createOAuthClient(baseUrl, (await r).pds.hostname);
        const url = await auth.authorize(handle);
        set({
          auth,
          pds: {
            url: url.toString(),
            loading: false,
            error: null,
          },
        });
        return url;
      } catch (error) {
        console.error("Failed to get login URL:", error);
        return null;
      }
    },

    oauthCallback: async (params) => {
      if (get().status === "loggedIn") return;
      const state = params.get("state");
      if (!state || !params.get("code") || !params.get("iss") || params.has("error")) {
        if (!get().login.loading) failCallback(new Error("Missing callback parameters"));
        return;
      }
      await callback.complete(state, params);
    },
    restorePdsAgent: async () => {
      const sessionToRestore = get().oauthSession;
      const did = sessionToRestore?.sub;
      if (!did) return;
      try {
        // restore session
        const sess = await initialAuth.restore(did);
        if (get().oauthSession !== sessionToRestore) return;

        if (!sess) {
          throw new Error("Failed to restore session");
        }

        const agent = new Agent(sess);

        set({
          pdsAgent: addDocs(agent),
          isAgentReady: true,
          status: "loggedIn",
        });
        get().populateLoggedInProfile();
        console.log("Restored agent");
      } catch (error) {
        if (get().oauthSession !== sessionToRestore || get().isAgentReady) return;
        console.error("Failed to restore agent:", error);
        get().logOut();
      }
    },
    logOut: () => {
      callback.cancel();
      console.log("Logging out");
      let profiles = { ...get().profiles };
      // TODO: something better than 'delete'
      delete profiles[get().pdsAgent?.did ?? ""];
      set({
        status: "loggedOut",
        oauthSession: null,
        oauthState: null,
        login: { loading: false, error: null },
        profiles,
        pdsAgent: null,
        isAgentReady: false,
        client: null,
        pds: null,
      });
    },
    populateLoggedInProfile: async () => {
      console.log("Populating logged in profile");
      const agent = get().pdsAgent;
      if (!agent) {
        throw new Error("No agent");
      }
      if (!agent.did) {
        throw new Error("No agent did! This is bad!");
      }
      try {
        let bskyProfile = await agent
          .getProfile({ actor: agent.did })
          .then((profile) => {
            console.log(profile);
            return profile.data || null;
          });
        // get teal did
        try {
          let tealDid = get().tealDid;
          let tealProfile = await agent
            .call(
              "fm.teal.actor.getProfile",
              { actor: agent?.did },
              {},
              { headers: { "atproto-proxy": tealDid + "#teal_fm_appview" } },
            )
            .then((profile) => {
              console.log(profile);
              return profile.data.actor || null;
            });

          set({
            profiles: {
              [agent.did]: { bsky: bskyProfile, teal: tealProfile },
            },
          });
        } catch (error) {
          console.error("Failed to get teal profile:", error);
          // insert bsky profile
          set({
            profiles: {
              [agent.did]: { bsky: bskyProfile, teal: null },
            },
          });
        }
      } catch (error) {
        console.error("Failed to get profile:", error);
      }
    },
  };
};

function addDocs(agent: Agent) {
  Lexicons.schemas
    .filter((schema) => !schema.id.startsWith("app.bsky."))
    .map((schema) => {
      try {
        agent.lex.add(schema);
      } catch (e) {
        console.error("Failed to add schema:", e);
      }
    });
  return agent;
}
