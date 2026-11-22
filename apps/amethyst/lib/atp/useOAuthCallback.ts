import { useEffect, useRef } from "react";

type RouteParams = Record<string, string | string[] | undefined>;

export function useOAuthCallback(
  params: RouteParams,
  complete: (response: URLSearchParams) => Promise<void>,
) {
  const handledStates = useRef(new Set<string>());
  useEffect(() => {
    const response = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) response.append(key, item);
      } else if (value !== undefined) {
        response.set(key, value);
      }
    }

    const state = response.get("state");
    if (
      response.has("error") ||
      !state ||
      !response.get("code") ||
      !response.get("iss")
    ) {
      return;
    }
    // The client consumes this state on first use. Renders can repeat before it settles.
    if (handledStates.current.has(state)) return;
    handledStates.current.add(state);
    void complete(response);
  }, [params, complete]);
}
