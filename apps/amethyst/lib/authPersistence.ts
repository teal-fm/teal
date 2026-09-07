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

export function mergeAuthentication<T extends RuntimeAuthentication>(
  persisted: unknown,
  current: T,
): T {
  if (!persisted || typeof persisted !== "object" || Array.isArray(persisted)) {
    return current;
  }
  // Older saves contain loggedIn and serialized clients. Keep startup state
  // until restorePdsAgent has reconstructed a working agent.
  return { ...current, ...persistAuthentication(persisted as Partial<T>) };
}
