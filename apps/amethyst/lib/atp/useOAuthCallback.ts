import { useEffect } from "react";
import { isCompleteOAuthResponse } from "./latestOAuthCallback";

type RouteParams = Record<string, string | string[] | undefined>;

export function useOAuthCallback(
  params: RouteParams,
  complete: (response: URLSearchParams) => Promise<void>,
  ready = true,
) {
  useEffect(() => {
    if (!ready) return;
    const response = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) response.append(key, item);
      } else if (value !== undefined) {
        response.set(key, value);
      }
    }

    if (isCompleteOAuthResponse(response)) void complete(response);
  }, [params, complete, ready]);
}
