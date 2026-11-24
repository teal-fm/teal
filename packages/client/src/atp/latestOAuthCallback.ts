import { z } from "zod";

const callbackFailure = z.object({ state: z.string() });

export function isCompleteOAuthResponse(params: URLSearchParams): boolean {
  return Boolean(params.get("code") && params.get("iss") && params.get("state") && !params.has("error"));
}

/** Share the exchange for a provider state and only apply the active attempt. */
export function latestOAuthCallback<T extends { state: string | null }>(
  currentAttempt: () => number,
  exchange: (params: URLSearchParams) => Promise<T>,
  onSuccess: (result: T) => void,
  onFailure: (error: Error) => void,
) {
  const exchanges = new Map<string, Promise<void>>();

  async function complete(params: URLSearchParams) {
    const state = params.get("state");

    if (!state || !isCompleteOAuthResponse(params)) return;

    const existing = exchanges.get(state);

    if (existing) return existing;

    const attempt = currentAttempt();
    // A callback already in flight during an app upgrade can have no app state.
    const expectedState = attempt === 0 ? null : String(attempt);

    const pending = (async () => {
      try {
        const result = await exchange(params);

        if (currentAttempt() === attempt && result.state === expectedState) onSuccess(result);
      } catch (error) {
        if (currentAttempt() !== attempt) return;
        const failure = callbackFailure.safeParse(error);

        if (failure.success && failure.data.state !== expectedState) return;
        onFailure(error instanceof Error ? error : new Error("OAuth callback failed"));
      }
    })();

    exchanges.set(state, pending);

    return pending;
  }

  return { complete };
}
