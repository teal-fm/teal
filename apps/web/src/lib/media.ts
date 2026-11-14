import { useSyncExternalStore } from "react";

/** Widths the shell switches at. Keep in step with the `nav:` and `rail:` breakpoints in styles.css. */
export const BREAKPOINTS = { sidebar: 1000, rail: 1280, phone: 700 } as const;

function useMedia(query: string, serverValue: boolean) {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Layout facts for code that can't be expressed in CSS. The server assumes a phone. */
export function useLayout() {
  const sidebar = useMedia(`(min-width: ${BREAKPOINTS.sidebar}px)`, false);
  const rail = useMedia(`(min-width: ${BREAKPOINTS.rail}px)`, false);
  const phone = !useMedia(`(min-width: ${BREAKPOINTS.phone}px)`, false);
  return { sidebar, rail, phone };
}

export function useReducedMotion() {
  return useMedia("(prefers-reduced-motion: reduce)", false);
}

const noop = () => () => {};

/** False on the server and during hydration, true after: for UI that reads browser-only state. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
