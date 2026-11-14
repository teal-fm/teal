import { useCallback, useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";
const KEY = "teal-color-scheme";

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** Runs in <head> before first paint, so a saved theme never flashes the other one. */
export const themeBootScript = `try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();
const dark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

/** The saved theme and whether the page is currently dark. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, read, () => "system" as const);
  const isDark = useSyncExternalStore(
    subscribe,
    () => (preference === "system" ? dark() : preference === "dark"),
    () => false,
  );
  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Unsaved, but still applied for this visit.
    }
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    for (const listener of listeners) listener();
  }, []);
  return { preference, isDark, setPreference };
}
