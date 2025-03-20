import { StateCreator } from './mainStore';

export interface PreferenceSlice {
  colorTheme: 'dark' | 'light' | 'system';
  setColorTheme: (theme: 'dark' | 'light' | 'system') => void;
  tealDid: string;
  setTealDid: (url: string) => void;
}

export const createPreferenceSlice: StateCreator<PreferenceSlice> = (set) => {
  return {
    colorTheme: 'system',
    setColorTheme: (theme) => set({ colorTheme: theme }),
    tealDid: 'did:web:rina.z.teal.fm',
    setTealDid: (url) => set({ tealDid: url }),
  };
};
