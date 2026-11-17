import type { Href } from "expo-router";

/**
 * A link to one of the app's own screens, from the shared `@teal/client` route
 * helpers or a path built the same way.
 */
export function appHref(path: string): Href {
  // SAFETY: callers pass paths built by @teal/client/teal/routes (or matching it),
  // and those mirror the screens under app/. Expo Router's typed routes can't see
  // through the helpers' string return type.
  return path as Href;
}
