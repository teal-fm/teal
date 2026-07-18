import { resolveFromIdentity } from "@/lib/atp/pid";
import { Agent, type AppBskyActorDefs } from "@atproto/api";
import { OAuthSession } from "@atproto/oauth-client";

import * as Lexicons from "@teal/lexicons/src/lexicons";
import type { ProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";

import createOAuthClient, { AquareumOAuthClient } from "../lib/atp/oauth";
import { pdsHostFromOAuthIssuer } from "../lib/atp/oauthIssuer";
import { StateCreator } from "./mainStore";

export interface AllProfileViews {
  bsky: null | AppBskyActorDefs.ProfileViewDetailed;
  teal: null | ProfileView;
}

export interface AuthenticationSlice {
  auth: AquareumOAuthClient;
  status: "start" | "loggedIn" | "loggedOut";
  oauthIssuer: null | string;
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

  console.log("Auth client created!");

  return {
    auth: initialAuth,
    status: "start",
    oauthIssuer: null,
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
      try {
        // resolve the handle to a PDS URL
        const resolvedIdentity = await resolveFromIdentity(handle);
        const auth = createOAuthClient(baseUrl, resolvedIdentity.pds.hostname);
        const url = await auth.authorize(handle);
        set({
          auth,
          oauthIssuer: `https://${resolvedIdentity.pds.hostname}`,
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

    oauthCallback: async (state: URLSearchParams) => {
      try {
        if (!(state.has("code") && state.has("state") && state.has("iss"))) {
          throw new Error("Missing params, got: " + state);
        }
        // are we already logged in?
        if (get().status === "loggedIn") {
          return;
        }
        const oauthIssuer = state.get("iss");
        const callbackAuth = createOAuthClient(
          baseUrl,
          pdsHostFromOAuthIssuer(
            oauthIssuer,
            pdsHostFromOAuthIssuer(get().oauthIssuer),
          ),
        );
        const { session, state: oauthState } =
          await callbackAuth.callback(state);
        const agent = new Agent(session);
        set({
          auth: callbackAuth,
          // TODO: fork or update auth lib
          oauthSession: session as any,
          oauthIssuer: oauthIssuer ?? get().oauthIssuer,
          oauthState,
          status: "loggedIn",
          pdsAgent: addDocs(agent),
          isAgentReady: true,
        });
        get().populateLoggedInProfile();
      } catch (error: any) {
        console.error("OAuth callback failed:", error);
        set({
          status: "loggedOut",
          login: {
            loading: false,
            error:
              (error?.message as string) ||
              "Unknown error during OAuth callback",
          },
        });
      }
    },
    restorePdsAgent: async () => {
      let did = get().oauthSession?.sub;
      if (!did) {
        set({ status: "loggedOut" });
        return;
      }
      try {
        // restore session
        const restoreAuth = createOAuthClient(
          baseUrl,
          pdsHostFromOAuthIssuer(get().oauthIssuer),
        );
        let sess = await restoreAuth.restore(did);

        if (!sess) {
          throw new Error("Failed to restore session");
        }

        const agent = new Agent(sess);

        set({
          auth: restoreAuth,
          pdsAgent: addDocs(agent),
          isAgentReady: true,
          status: "loggedIn",
        });
        get().populateLoggedInProfile();
        console.log("Restored agent");
      } catch (error) {
        console.error("Failed to restore agent:", error);
        get().logOut();
      }
    },
    logOut: () => {
      console.log("Logging out");
      let profiles = { ...get().profiles };
      // TODO: something better than 'delete'
      delete profiles[get().pdsAgent?.did ?? ""];
      set({
        status: "loggedOut",
        oauthSession: null,
        oauthIssuer: null,
        oauthState: null,
        profiles,
        pdsAgent: null,
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
          const tealDid = get().tealDid;
          const tealProfile = await agent
            .call(
              "fm.teal.alpha.actor.getProfile",
              { actor: agent?.did },
              {},
              { headers: { "atproto-proxy": tealDid + "#teal_fm_appview" } },
            )
            .then((profile) => {
              console.log(profile);
              const data = profile.data as {
                actor?: ProfileView;
                profile?: ProfileView;
              };
              return data.profile || data.actor || null;
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
