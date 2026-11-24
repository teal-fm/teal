import { resolveFromIdentity } from "@teal/client/atp/pid";
import { Agent, type AppBskyActorDefs } from "@atproto/api";
import { OAuthSession } from "@atproto/oauth-client";

import * as Lexicons from "@teal/lexicons/src/documents";
import type { ProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";

import createOAuthClient, { APP_BASE_URL, AquareumOAuthClient } from "../lib/atp/oauth";
import { pdsHostFromOAuthIssuer } from "@teal/client/atp/oauthIssuer";
import { latestOAuthCallback } from "@teal/client/atp/latestOAuthCallback";
import { getProfile, XrpcError } from "@teal/client/teal/api";
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
  loginAttempt: number;
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
  const baseUrl = APP_BASE_URL;
  const initialAuth = createOAuthClient(baseUrl, "bsky.social");

  const callback = latestOAuthCallback(
    () => get().loginAttempt,
    async (params) => {
      const issuer = params.get("iss");

      const auth = createOAuthClient(
        baseUrl,
        pdsHostFromOAuthIssuer(issuer, pdsHostFromOAuthIssuer(get().oauthIssuer)),
      );

      return { ...(await auth.callback(params)), auth, issuer };
    },
    ({ session, state, auth, issuer }) => {
      if (get().status === "loggedIn") return;
      set({
        auth,
        oauthSession: session,
        oauthIssuer: issuer ?? get().oauthIssuer,
        oauthState: state,
        status: "loggedIn",
        login: { loading: false, error: null },
        pdsAgent: addDocs(new Agent(session)),
        isAgentReady: true,
      });
      void get().populateLoggedInProfile();
    },
    (error) => {
      if (get().status === "loggedIn") return;
      console.error("OAuth callback failed:", error);
      set({
        status: "loggedOut",
        login: {
          loading: false,
          error: error.message,
        },
      });
    },
  );

  console.log("Auth client created!");

  return {
    auth: initialAuth,
    status: "start",
    oauthIssuer: null,
    oauthState: null,
    loginAttempt: 0,
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
      const attempt = get().loginAttempt + 1;
      set({ loginAttempt: attempt, login: { loading: false, error: null } });

      try {
        // resolve the handle to a PDS URL
        const resolvedIdentity = await resolveFromIdentity(handle);
        const auth = createOAuthClient(baseUrl, resolvedIdentity.pds.hostname);
        const url = await auth.authorize(handle, { state: String(attempt) });

        if (get().loginAttempt !== attempt) return null;
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

    oauthCallback: async (params: URLSearchParams) => {
      if (get().status === "loggedIn") return;
      await callback.complete(params);
    },
    restorePdsAgent: async () => {
      const previous = get().oauthSession;
      const attempt = get().loginAttempt;
      const did = previous?.sub;

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

        if (get().oauthSession !== previous || get().loginAttempt !== attempt || get().isAgentReady) return;

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
        if (get().oauthSession !== previous || get().loginAttempt !== attempt || get().isAgentReady) return;
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
        loginAttempt: get().loginAttempt + 1,
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
          // Aqua is the source of truth for Teal identity data. Fetching it
          // directly avoids depending on the user's PDS proxy configuration,
          // which can otherwise leave the shell showing stale Bluesky data.
          const tealProfile = await getProfile(agent.did).then(
            ({ profile }) => profile,
          );

          set({
            profiles: {
              [agent.did]: { bsky: bskyProfile, teal: tealProfile },
            },
          });
        } catch (error) {
          if (!(error instanceof XrpcError && error.status === 404)) {
            console.error("Failed to get teal profile:", error);
          }

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
    .filter((schema) => schema.id.startsWith("fm.teal."))
    .map((schema) => {
      try {
        agent.lex.add(schema);
      } catch (e) {
        console.error("Failed to add schema:", e);
      }
    });

  return agent;
}
