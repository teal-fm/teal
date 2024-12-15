import create from "zustand";
import { StateCreator } from "./mainStore";
import createOAuthClient, { AquareumOAuthClient } from "@/lib/atp/oauth";
import { OAuthSession } from "@atproto/oauth-client";
import { ProfileViewDetailed } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import { Agent } from "@atproto/api";

export interface AuthenticationSlice {
  auth: AquareumOAuthClient;
  status: "start" | "loggedIn" | "loggedOut";
  oauthState: null | string;
  oauthSession: null | OAuthSession;
  pdsAgent: null | Agent;
  isAgentReady: boolean;
  profiles: { [key: string]: ProfileViewDetailed };
  client: null | AquareumOAuthClient;
  login: {
    loading: boolean;
    error: null | string;
  };
  pds: {
    url: string;
    loading: boolean;
    error: null | string;
  };
  getLoginUrl: (handle: string) => Promise<URL | null>;
  oauthCallback: (state: URLSearchParams) => Promise<void>;
  restorePdsAgent: () => void;
  logOut: () => void;
}

export const createAuthenticationSlice: StateCreator<AuthenticationSlice> = (
  set, get
) => {
  const initialAuth = createOAuthClient("http://localhost:8081");

  console.log("Auth client created!")

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
    pds: {
      url: "bsky.social",
      loading: false,
      error: null,
    },

    getLoginUrl: async (handle: string) => {
      try {
        const url = await initialAuth.authorize(handle);
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
        const { auth } = get();
        const { session, state: oauthState } = await auth.callback(state);
        const agent = new Agent(session);
        set({
          oauthSession: session,
          oauthState,
          status: "loggedIn",
          pdsAgent: agent,
          isAgentReady: true,
        });
      } catch (error:any) {
        console.error("OAuth callback failed:", error);
        set({
          status: "loggedOut",
          login: {
            loading: false,
            error: (error?.message as string) || "Unknown error during OAuth callback",
          },
        });
      }
    },
    restorePdsAgent: async () => {
      let did = get().oauthSession?.sub;
      if (!did) {
        throw new Error("No session");
      }
      // restore session
      let sess = await initialAuth.restore(did);

      if (!sess) {
        throw new Error("Failed to restore session");
      }

      set({
        pdsAgent: new Agent(sess),
        isAgentReady: true,
      });
      console.log("Restored agent");
    },
    logOut: () => {
      set({
        status: "loggedOut",
        oauthSession: null,
        oauthState: null,
        profiles: {},
        pdsAgent: null,
        client: null,
      });
    },
  };
};
