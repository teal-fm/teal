export function isCompleteOAuthResponse(params: URLSearchParams): boolean {
  return !!(params.get("state") && params.get("code") && params.get("iss") && !params.has("error"));
}

// The SDK returns the application state saved when authorization started.
export function latestOAuthCallback<T extends { state: string | null }>(
  currentAttempt: () => number,
  exchange: (params: URLSearchParams) => Promise<T>,
  onSuccess: (result: T) => void,
  onFailure: (error: unknown) => void,
) {
  const responses = new Map<string, Promise<void>>();

  async function exchangeForAttempt(params: URLSearchParams) {
    const attempt = currentAttempt();
    try {
      const result = await exchange(params);
      if (attempt === currentAttempt() && result.state === String(attempt)) {
        onSuccess(result);
      }
    } catch (error) {
      if (attempt !== currentAttempt()) return;
      if (error && typeof error === "object" && "state" in error && error.state !== String(attempt)) return;
      onFailure(error);
    }
  }

  return {
    async complete(params: URLSearchParams) {
      if (!isCompleteOAuthResponse(params)) return;
      const state = params.get("state")!;
      // The OAuth client consumes state once, even when the callback route remounts.
      const response = responses.get(state);
      if (response) return response;

      const pending = exchangeForAttempt(params);
      responses.set(state, pending);
      return pending;
    },
  };
}
