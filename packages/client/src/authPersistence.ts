import { z } from "zod";

interface RuntimeAuthentication {
  status?: unknown;
  auth?: unknown;
  client?: unknown;
  pdsAgent?: unknown;
  isAgentReady?: unknown;
}

export function persistAuthentication<T extends RuntimeAuthentication>(state: T) {
  const { status, auth, client, pdsAgent, isAgentReady, ...persisted } = state;

  return persisted;
}

const persistedStateSchema = z.record(z.string(), z.unknown());

export function mergeAuthentication<T extends RuntimeAuthentication>(
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- zustand's persist `merge` hands over raw storage; it is parsed below.
  persisted: unknown,
  current: T,
): T {
  const parsed = persistedStateSchema.safeParse(persisted);

  if (!parsed.success) return current;

  // Older saves contain loggedIn and serialized clients. Keep startup state
  // until restorePdsAgent has reconstructed a working agent.
  // SAFETY: zustand persisted this object from a T via persistAuthentication, and
  // persistAuthentication drops every runtime field before it is merged back.
  return { ...current, ...persistAuthentication(parsed.data as Partial<T>) };
}
