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

/**
 * Loaders await data on the server, so the first HTML carries it and its meta tags.
 * In the browser they only start the fetch, and the page shows its own loading state.
 */
export async function serverAwait<T>(work: () => Promise<T>): Promise<T | undefined> {
  if (import.meta.env.SSR) {
    try {
      return await work();
    } catch {
      return undefined;
    }
  }
  void work().catch(() => undefined);
  return undefined;
}
