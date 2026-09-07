import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { mergeAuthentication, persistAuthentication } from "../authPersistence";

interface State {
  status: "start" | "loggedIn" | "loggedOut";
  auth: object;
  client: object | null;
  pdsAgent: object | null;
  isAgentReady: boolean;
  oauthSession: { sub: string } | null;
  oauthIssuer: string | null;
  colorTheme: string;
}

const initial: State = {
  status: "start",
  auth: { runtimeClient: true },
  client: null,
  pdsAgent: null,
  isAgentReady: false,
  oauthSession: null,
  oauthIssuer: null,
  colorTheme: "system",
};

const saved = {
  status: "loggedIn",
  auth: { obsoleteSerializedClient: true },
  client: {},
  isAgentReady: true,
  oauthSession: { sub: "did:plc:example" },
  oauthIssuer: "https://teal.town",
  colorTheme: "dark",
};

it("keeps protected routes loading until the saved session is restored", async () => {
  let stored = JSON.stringify({ state: saved, version: 0 });
  const storage: StateStorage = {
    getItem: async () => stored,
    setItem: async (_name, value) => { stored = value; },
    removeItem: async () => { stored = ""; },
  };
  const store = createStore<State>()(persist(() => ({ ...initial }), {
    name: "auth-test",
    storage: createJSONStorage(() => storage),
    partialize: persistAuthentication,
    merge: mergeAuthentication,
    skipHydration: true,
  }));

  await store.persist.rehydrate();

  // Hydration has finished, but the network restore has not yet produced an agent.
  expect(store.getState()).toMatchObject({
    status: "start", pdsAgent: null, isAgentReady: false, client: null,
    oauthSession: saved.oauthSession, oauthIssuer: saved.oauthIssuer, colorTheme: "dark",
  });
  expect(store.getState().auth).toBe(initial.auth);

  const restoredAgent = {};
  store.setState({ status: "loggedIn", pdsAgent: restoredAgent, isAgentReady: true });
  expect(store.getState().pdsAgent).toBe(restoredAgent);
  expect(JSON.parse(stored).state).toEqual({
    oauthSession: saved.oauthSession, oauthIssuer: saved.oauthIssuer, colorTheme: "dark",
  });
});

it.each([undefined, null, "invalid", 42])("keeps startup defaults without saved state: %p", (savedState) => {
  expect(mergeAuthentication(savedState, initial)).toEqual(initial);
});
