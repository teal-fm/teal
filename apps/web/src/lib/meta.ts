/** Link-preview tags for a page, so shared links unfurl with a title, line, and image. */
export function pageMeta({ title, description, image }: { title: string; description?: string; image?: string }) {
  const full = `${title} · Teal`;
  return [
    { title: full },
    { property: "og:title", content: title },
    { name: "twitter:title", content: title },
    ...(description
      ? [
          { name: "description", content: description },
          { property: "og:description", content: description },
          { name: "twitter:description", content: description },
        ]
      : []),
    ...(image
      ? [
          { property: "og:image", content: image },
          { name: "twitter:image", content: image },
          { name: "twitter:card", content: "summary" },
        ]
      : []),
  ];
}

/** How long a server render waits for Aqua before sending the page without the data. */
const SSR_BUDGET_MS = 1500;

/**
 * Loaders await data on the server, so the first HTML carries it and its meta tags.
 * A slow or failing Aqua doesn't hold the page: past the budget it renders its own
 * loading state and the browser fetches (and retries) instead. In the browser,
 * loaders only start the fetch.
 */
export async function serverAwait<T>(work: () => Promise<T>): Promise<T | undefined> {
  if (import.meta.env.SSR) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work(),
        new Promise<undefined>((resolve) => {
          timer = setTimeout(() => resolve(undefined), SSR_BUDGET_MS);
        }),
      ]);
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }
  void work().catch(() => undefined);
  return undefined;
}

/** Query options for a server loader: one attempt, since the browser retries if it fails. */
export function once<T extends object>(options: T): T & { retry: false } {
  return { ...options, retry: false };
}
