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
