// Provider responses can finish after a newer sign-in or a logout.
export function latestOAuthCallback<T>(
  exchange: (params: URLSearchParams) => Promise<T>,
  onSuccess: (result: T) => void,
  onFailure: (error: unknown) => void,
) {
  let generation = 0;
  return {
    cancel() {
      generation++;
    },
    async complete(params: URLSearchParams) {
      const attempt = ++generation;
      try {
        const result = await exchange(params);
        if (attempt === generation) onSuccess(result);
      } catch (error) {
        if (attempt === generation) onFailure(error);
      }
    },
  };
}
