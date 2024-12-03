import { StateCreator } from "./mainStore";

export interface AuthCodeSlice {
  authCode: string | null;
  setAuthCode: (authCode: string) => void;
}

export const createAuthCodeSlice: StateCreator<AuthCodeSlice> = (set) => ({
  authCode: null,
  setAuthCode: (authCode) => set({ authCode }),
});
