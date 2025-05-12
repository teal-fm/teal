import { StateCreator } from "./mainStore";

export interface TempSlice {
  hello: () => string;
}

export const createTempSlice: StateCreator<TempSlice> = (set) => {
  return {
    hello: () => {
      return "world";
    },
  };
};
