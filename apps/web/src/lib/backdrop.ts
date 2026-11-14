import { useCallback, useSyncExternalStore } from "react";

/**
 * How the cover-colour backdrop looks, saved in this browser. Each setting is
 * a `data-*` attribute on <html>, so CSS applies it before the first paint.
 */
export type BackdropPreferences = {
  /** "off" shows the plain ground instead of cover colour. */
  backdrop: "on" | "off";
  /** "still" stops the covers drifting and turning. */
  motion: "moving" | "still";
  /** "muted" softens the colour. */
  colour: "vivid" | "muted";
};

const DEFAULTS: BackdropPreferences = { backdrop: "on", motion: "moving", colour: "vivid" };
const ATTRIBUTES = { backdrop: "backdrop", motion: "backdropMotion", colour: "backdropColour" } as const;
const KEY = (name: keyof BackdropPreferences) => `teal-${name}`;

function readOne<K extends keyof BackdropPreferences>(name: K): BackdropPreferences[K] {
  try {
    return (localStorage.getItem(KEY(name)) as BackdropPreferences[K] | null) ?? DEFAULTS[name];
  } catch {
    return DEFAULTS[name];
  }
}

/** Runs in <head> before first paint, alongside the theme. Only non-default values are saved. */
export const backdropBootScript = `try{${(Object.keys(ATTRIBUTES) as (keyof BackdropPreferences)[])
  .map(
    (name) =>
      `var ${name}=localStorage.getItem(${JSON.stringify(KEY(name))});if(${name})document.documentElement.dataset.${ATTRIBUTES[name]}=${name};`,
  )
  .join("")}}catch(e){}`;

const listeners = new Set<() => void>();
let snapshot: BackdropPreferences | undefined;

function read() {
  const next = { backdrop: readOne("backdrop"), motion: readOne("motion"), colour: readOne("colour") };
  if (!snapshot || (Object.keys(next) as (keyof BackdropPreferences)[]).some((k) => next[k] !== snapshot?.[k])) {
    snapshot = next;
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBackdropPreferences() {
  const preferences = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  const set = useCallback(<K extends keyof BackdropPreferences>(name: K, value: BackdropPreferences[K]) => {
    try {
      if (value === DEFAULTS[name]) localStorage.removeItem(KEY(name));
      else localStorage.setItem(KEY(name), value);
    } catch {
      // Unsaved, but still applied for this visit.
    }
    const root = document.documentElement;
    if (value === DEFAULTS[name]) delete root.dataset[ATTRIBUTES[name]];
    else root.dataset[ATTRIBUTES[name]] = value;
    for (const listener of listeners) listener();
  }, []);
  return { preferences, set };
}
