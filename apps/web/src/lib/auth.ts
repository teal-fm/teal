import { Agent, type AppBskyActorDefs } from "@atproto/api";
import type { OAuthSession } from "@atproto/oauth-client-browser";
import { create } from "zustand";

import * as Lexicons from "@teal/lexicons/src/documents";
import type { ProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";
import { getProfile, XrpcError } from "@teal/client/teal/api";

import { oauthClient, onSessionDeleted } from "./oauth";

export type ViewerProfiles = {
  bsky: AppBskyActorDefs.ProfileViewDetailed | null;
  teal: ProfileView | null;
};

type AuthState = {
  /** "start" until the browser has checked for a saved session. The server always renders "start". */
  status: "start" | "loggedIn" | "loggedOut";
  agent: Agent | null;
  session: OAuthSession | null;
  profile: ViewerProfiles | null;
  /** Set when returning from the account provider failed. */
  callbackError: string | null;
};

export const useAuth = create<AuthState>(() => ({
  status: "start",
  agent: null,
  session: null,
  profile: null,
  callbackError: null,
}));

/** Teaches the agent Teal's lexicons, so record calls validate against them. */
function withTealLexicons(agent: Agent) {
  for (const schema of Lexicons.schemas) {
    if (!schema.id.startsWith("fm.teal.")) continue;
    try {
      agent.lex.add(schema);
    } catch {
      // Already added.
    }
  }
  return agent;
}

function signedIn(session: OAuthSession) {
  const agent = withTealLexicons(new Agent(session));
  useAuth.setState({ status: "loggedIn", session, agent, callbackError: null });
  void loadViewerProfile(agent);
}

let started: Promise<void> | undefined;

/**
 * Restores the saved session, or finishes a sign-in when the page is the OAuth
 * callback. Runs once per page load, in the browser.
 */
export function startAuth() {
  started ??= (async () => {
    const client = oauthClient();
    onSessionDeleted((sub) => {
      if (useAuth.getState().agent?.did !== sub) return;
      useAuth.setState({ status: "loggedOut", agent: null, session: null, profile: null });
    });
    try {
      const result = await client.init();
      if (result) signedIn(result.session);
      else useAuth.setState({ status: "loggedOut" });
    } catch (error) {
      // A stale or replayed callback lands here; a plain page load with no session does not.
      useAuth.setState({
        status: "loggedOut",
        callbackError: error instanceof Error ? error.message : "Sign-in didn't finish.",
      });
    }
  })();
  return started;
}

/** Sends the browser to the account provider. Resolves only if that fails. */
export async function signIn(handle: string) {
  await oauthClient().signInRedirect(handle);
}

export async function signOut() {
  const { session } = useAuth.getState();
  useAuth.setState({ status: "loggedOut", agent: null, session: null, profile: null });
  if (session) await session.signOut().catch(() => undefined);
}

async function loadViewerProfile(agent: Agent) {
  const did = agent.did;
  if (!did) return;
  const bsky = await agent
    .getProfile({ actor: did })
    .then((res) => res.data)
    .catch(() => null);
  // Aqua is the source of truth for Teal identity, so read it directly rather
  // than through the user's PDS proxy.
  const teal = await getProfile(did)
    .then((res) => res.profile)
    .catch((error) => {
      if (!(error instanceof XrpcError && error.status === 404)) {
        console.error("Failed to load the teal profile", error);
      }
      return null;
    });
  if (useAuth.getState().agent?.did === did) useAuth.setState({ profile: { bsky, teal } });
}

/** Re-reads the viewer's profile, e.g. after editing it. */
export function refreshViewerProfile() {
  const { agent } = useAuth.getState();
  if (agent) void loadViewerProfile(agent);
}
