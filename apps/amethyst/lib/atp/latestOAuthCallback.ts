// Provider responses can finish after a newer sign-in or a logout.
export function latestOAuthCallback<T>(
  exchange: (params: URLSearchParams) => Promise<T>,
  onSuccess: (result: T) => void,
  onFailure: (error: unknown) => void,
) {
  let generation = 0;
  const responses = new Map<string, Promise<void>>();

  async function exchangeLatest(params: URLSearchParams) {
    const attempt = ++generation;
    try {
      const result = await exchange(params);
      if (attempt === generation) onSuccess(result);
    } catch (error) {
      if (attempt === generation) onFailure(error);
    }
  }

  return {
    cancel() {
      generation++;
    },
    complete(state: string, params: URLSearchParams) {
      // The OAuth client consumes state once, even when the callback route remounts.
      const response = responses.get(state);
      if (response) return response;

      const pending = exchangeLatest(params);
      responses.set(state, pending);
      return pending;
    },
  };
}
