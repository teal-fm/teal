import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "@tanstack/react-router";
import type {
  HappyViewBrowserClient,
  HappyViewSession,
} from "@happyview/oauth-client-browser";

import { getAuthConfig, getProfilesFor } from "./api";
import { CALLBACK_PATH, isLoopback, oauthClient, SCOPES } from "./oauth";
import type { Profile } from "./types";

/**
 * Sign-in runs in the browser against HappyView's public API client: the
 * OAuth session (a DPoP key and tokens) lives in this browser's storage, and
 * writes go to HappyView procedures, which write to the person's PDS.
 */
type Auth =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "signed-in"; did: string; profile?: Profile };

interface AuthContext {
  auth: Auth;
  /** Why the last sign-in failed, if it did. */
  error?: string;
  signIn: (handle: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Calls one of the site's HappyView procedures as the signed-in person. */
  call: <T>(nsid: string, input: unknown) => Promise<T>;
}

const Context = createContext<AuthContext | undefined>(undefined);

/** Locally, loopback OAuth redirects to 127.0.0.1, whose storage localhost can't see. */
const HANDOFF = "#signin=";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [auth, setAuth] = useState<Auth>({ status: "loading" });
  const [error, setError] = useState<string>();
  const client = useRef<HappyViewBrowserClient | undefined>(undefined);
  const session = useRef<HappyViewSession | undefined>(undefined);

  const signedIn = (next: HappyViewSession) => {
    session.current = next;
    setAuth({ status: "signed-in", did: next.did });
    getProfilesFor({ data: { dids: [next.did] } })
      .then((profiles) =>
        setAuth((current) =>
          current.status === "signed-in" && current.did === next.did
            ? { ...current, profile: profiles[next.did] }
            : current,
        ),
      )
      .catch(() => undefined);
  };

  const signIn = async (handle: string) => {
    setError(undefined);
    const identifier = handle.trim().replace(/^@/, "");
    if (!identifier) return;
    const returnTo = `${location.pathname}${location.search}`;

    if (location.hostname === "localhost") {
      location.assign(
        `${location.protocol}//127.0.0.1:${location.port}${returnTo}${HANDOFF}${encodeURIComponent(identifier)}`,
      );
      return;
    }
    if (!client.current) {
      setError("Sign-in isn't available right now.");
      return;
    }
    try {
      await client.current.signIn(identifier, { state: returnTo });
    } catch (cause) {
      console.error("sign-in", cause);
      setError(`Couldn't find ${identifier}. Check the handle and try again.`);
    }
  };

  const signOut = async () => {
    const current = session.current;
    session.current = undefined;
    setAuth({ status: "signed-out" });
    await current?.signOut().catch(() => undefined);
  };

  const call = async <T,>(nsid: string, input: unknown): Promise<T> => {
    if (!session.current) throw new Error("Sign in first.");
    const response = await session.current.fetchHandler(`/xrpc/${nsid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await response.json().catch(() => undefined)) as
      | (T & { error?: string; message?: string })
      | undefined;
    if (!response.ok || !body || body.error) {
      if (response.status === 401) await signOut();
      throw new Error(
        body?.message ?? "That didn't go through. Try again in a minute.",
      );
    }

    return body;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const config = await getAuthConfig().catch(() => undefined);
      if (!config) {
        if (!cancelled) setAuth({ status: "unavailable" });
        return;
      }
      const { HappyViewBrowserClient } = await import(
        "@happyview/oauth-client-browser"
      );
      if (cancelled) return;
      client.current = new HappyViewBrowserClient({
        ...config,
        ...oauthClient(location),
        scopes: SCOPES,
      });

      const onCallback = location.pathname === CALLBACK_PATH;
      try {
        const result = await client.current.init();
        if (cancelled) return;
        if (result?.session) signedIn(result.session);
        else setAuth({ status: "signed-out" });
        if (onCallback) {
          const state = result && "state" in result ? result.state : null;
          router.history.replace(state?.startsWith("/") ? state : "/");
        }
      } catch (cause) {
        console.error("sign-in callback", cause);
        if (cancelled) return;
        setAuth({ status: "signed-out" });
        setError("Sign-in didn't finish. Try again.");
        if (onCallback) router.history.replace("/");
      }

      if (location.hash.startsWith(HANDOFF) && isLoopback(location)) {
        const handle = decodeURIComponent(location.hash.slice(HANDOFF.length));
        history.replaceState(null, "", location.pathname + location.search);
        await signIn(handle);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once per page load; signIn only reads refs and location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Context.Provider value={{ auth, error, signIn, signOut, call }}>
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("useAuth needs an AuthProvider");

  return context;
}

/** True when the signed-in person wrote this play. */
export function useOwns(did: string) {
  const { auth } = useAuth();

  return auth.status === "signed-in" && auth.did === did;
}
