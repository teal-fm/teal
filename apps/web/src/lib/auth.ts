import type { Agent, AppBskyActorDefs } from "@atproto/api";
import type { OAuthSession } from "@atproto/oauth-client-browser";
import { create } from "zustand";

import type { ProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";

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

/**
 * The signed-in account. This module stays small so every page can read it;
 * the OAuth client and agent live in `authSession.ts`, loaded on demand.
 */
export const useAuth = create<AuthState>(() => ({
  status: "start",
  agent: null,
  session: null,
  profile: null,
  callbackError: null,
}));

const session = () => import("./authSession");

let started: Promise<void> | undefined;

/** Restores the saved session or finishes an OAuth callback. Once per page load, in the browser. */
export function startAuth() {
  started ??= session().then((m) => m.restore());
  return started;
}

/** Sends the browser to the account provider. Resolves only if that fails. */
export async function signIn(handle: string) {
  await (await session()).redirectToSignIn(handle);
}

export async function signOut() {
  const current = useAuth.getState().session;
  useAuth.setState({ status: "loggedOut", agent: null, session: null, profile: null });
  if (current) await current.signOut().catch(() => undefined);
}

/** Re-reads the viewer's profile, e.g. after editing it. */
export function refreshViewerProfile() {
  const { agent } = useAuth.getState();
  if (agent) void session().then((m) => m.loadViewerProfile(agent));
}
