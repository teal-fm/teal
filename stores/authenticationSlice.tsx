import { StateCreator } from "./mainStore";

export interface AtpJWT {
  tokenSet?: TokenSet;
  dpopJwk?: DpopJwk;
}

export interface DpopJwk {
  kty?: string;
  use?: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
}

export interface TokenSet {
  aud?: string;
  sub?: string;
  iss?: string;
  scope?: string;
  refresh_token?: string;
  access_token?: string;
  token_type?: string;
  expires_at?: Date;
}

export interface AuthenticationSlice {
  jwt: AtpJWT | null;
  setJwt: (jwt: AtpJWT) => void;
  /// Log out the user. THIS WILL *ONLY* CLEAR THE JWT!!!
  logOut: () => void;
}

export const createAuthenticationSlice: StateCreator<AuthenticationSlice> = (
  set,
) => ({
  jwt: null,
  setJwt: (jwt) => set({ jwt }),
  logOut: () => set({ jwt: null }),
});
