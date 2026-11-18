import { QueryClient } from "@tanstack/react-query";

import { XrpcError } from "./teal/api";

/**
 * Server state lives in TanStack Query; each app's store keeps only local state
 * (auth, prefs). A server renderer makes one client per request.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: (failureCount, error) =>
          !(error instanceof XrpcError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

// SAFETY: widens the first page's `undefined` so TanStack Query types later
// pages' cursors as strings.
/** The page param of a cursor-paginated query's first page. */
export const FIRST_PAGE = undefined as string | undefined;
