import { configureClient, type KeyValueStorage } from "@teal/client/config";

/** localStorage behind the shared async storage interface; private windows can throw. */
const browserStorage: KeyValueStorage = {
  getItem: async (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage is a convenience here; the app works without it.
    }
  },
  removeItem: async (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // As above.
    }
  },
};

let configured = false;

/**
 * Points the shared client at Aqua. The browser uses its own origin, which
 * proxies /xrpc; the server renderer talks to Aqua directly.
 */
export function setupClient() {
  if (configured) return;
  configured = true;
  if (import.meta.env.SSR) {
    configureClient({
      aquaUrl: process.env.AQUA_URL || "http://localhost:3000",
      publicOrigin: process.env.PUBLIC_ORIGIN || "http://localhost:8081",
    });
  } else {
    configureClient({ aquaUrl: "", publicOrigin: window.location.origin, storage: browserStorage });
  }
}
