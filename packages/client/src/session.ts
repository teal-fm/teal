import { createContext, createElement, useContext, type ReactNode } from "react";
import type { Agent } from "@atproto/api";

/**
 * The signed-in account, as each app's auth store sees it. Shared hooks read the
 * viewer and the PDS agent from here instead of reaching into an app's store.
 */
export type Session = {
  /** The signed-in DID, once the agent is ready. */
  viewer?: string;
  agent: Agent | null;
};

const SessionContext = createContext<Session>({ agent: null });

export function SessionProvider({ value, children }: { value: Session; children: ReactNode }) {
  return createElement(SessionContext.Provider, { value }, children);
}

export function useSession() {
  return useContext(SessionContext);
}

/** The signed-in DID, or undefined when signed out or still restoring. */
export function useViewerDid() {
  return useSession().viewer;
}

export function usePdsAgent() {
  return useSession().agent;
}
