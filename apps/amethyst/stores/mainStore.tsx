import AsyncStorage from "@react-native-async-storage/async-storage";
import { create, StateCreator as ZustandStateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  AuthenticationSlice,
  createAuthenticationSlice,
} from "./authenticationSlice";
import { createPreferenceSlice, PreferenceSlice } from "./preferenceSlice";
import { createTempSlice, TempSlice } from "./tempSlice";

/// Put all your non-shared slices here
export type Slices = AuthenticationSlice & TempSlice & PreferenceSlice;
/// Put all your shared slices here
export type PlusSharedSlices = Slices;
/// Convenience type for creating a store. Uses the slices type defined above.
/// Type parameter T is the type of the state object.
export type StateCreator<T> = ZustandStateCreator<Slices, [], [], T>;

export const useStore = create<PlusSharedSlices>()(
  persist(
    (...a) => ({
      ...createAuthenticationSlice(...a),
      ...createTempSlice(...a),
      ...createPreferenceSlice(...a),
    }),
    {
      partialize: ({ pdsAgent, isAgentReady, ...state }) => state,

      onRehydrateStorage: () => (state) => {
        state?.restorePdsAgent();
      },
      name: "mainStore",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
