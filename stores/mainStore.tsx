import { create, StateCreator as ZustandStateCreator } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createAuthCodeSlice, AuthCodeSlice } from "./authCodeSlice";
import {
  AuthenticationSlice,
  createAuthenticationSlice,
} from "./authenticationSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";

/// Put all your non-shared slices here
export type Slices = AuthCodeSlice & AuthenticationSlice;
/// Put all your shared slices here
export type PlusSharedSlices = Slices;
/// Convenience type for creating a store. Uses the slices type defined above.
/// Type parameter T is the type of the state object.
export type StateCreator<T> = ZustandStateCreator<Slices, [], [], T>;

export const useStore = create<PlusSharedSlices>()(
  persist(
    (...a) => ({
      ...createAuthCodeSlice(...a),
      ...createAuthenticationSlice(...a),
    }),
    {
      name: "mainStore",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
