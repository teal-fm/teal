/** Async key-value storage: AsyncStorage on native, localStorage on the web, memory on a server. */
export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function memoryStorage(): KeyValueStorage {
  const items = new Map<string, string>();
  return {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => void items.set(key, value),
    removeItem: async (key) => void items.delete(key),
  };
}

export type ClientConfig = {
  /** Where Aqua answers XRPC. Empty means the page's own origin, which proxies /xrpc. */
  aquaUrl: string;
  /** The public app origin used for share links when there is no page origin. */
  publicOrigin: string;
  storage: KeyValueStorage;
};

let config: ClientConfig = {
  aquaUrl: "",
  publicOrigin: "https://teal.fm",
  storage: memoryStorage(),
};

/** Each app calls this once at startup, before anything fetches or reads storage. */
export function configureClient(next: Partial<ClientConfig>) {
  config = { ...config, ...next };
}

export function clientConfig(): Readonly<ClientConfig> {
  return config;
}
