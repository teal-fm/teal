import { QueryClient } from "@tanstack/react-query";

import { XrpcError } from "./teal/api";

// Server state lives in TanStack Query; zustand keeps only local app state (auth, prefs).
export const queryClient = new QueryClient({
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
