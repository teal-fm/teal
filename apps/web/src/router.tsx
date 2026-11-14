import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { createQueryClient } from "@teal/client/query";

import { setupClient } from "./lib/client";
import { routeTree } from "./routeTree.gen";

/**
 * Public URLs match the native app's and the shared href helpers: music pages
 * live under `/:o/music/…` and record links under `/at://…`. Vite can't load
 * route files with a colon in their path, so internally they're `/music` and `/at`.
 */
const PUBLIC_TO_INTERNAL: [RegExp, string][] = [
  [/^\/(?::|%3A)o\/music(?=\/|$)/i, "/music"],
  [/^\/at(?::|%3A)\/*/i, "/at/"],
];
const INTERNAL_TO_PUBLIC: [RegExp, string][] = [
  [/^\/music(?=\/|$)/, "/:o/music"],
  [/^\/at\//, "/at://"],
];

function rewritePath(url: URL, rules: [RegExp, string][]) {
  for (const [pattern, replacement] of rules) {
    if (pattern.test(url.pathname)) {
      url.pathname = url.pathname.replace(pattern, replacement);
      return url;
    }
  }
  return undefined;
}

export function getRouter() {
  setupClient();
  // One query client per request on the server, so viewers never share a cache.
  const queryClient = createQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    // TanStack Query owns freshness; the router shouldn't cache loader results on top.
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
    scrollRestoration: true,
    rewrite: {
      input: ({ url }) => rewritePath(url, PUBLIC_TO_INTERNAL),
      output: ({ url }) => rewritePath(url, INTERNAL_TO_PUBLIC),
    },
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
