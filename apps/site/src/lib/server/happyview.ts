import { cached } from "./cache";

type Params = Record<string, string | number | undefined>;

/**
 * Calls one of the site's HappyView queries. The site is a confidential API
 * client, so the key and secret stay on the server.
 */
export function happyview<T>(
  nsid: string,
  params: Params,
  ttl = 0,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const load = () => request<T>(`/xrpc/${nsid}?${search}`);

  return ttl > 0 ? cached(`hv:${nsid}?${search}`, ttl, load) : load();
}

async function request<T>(path: string): Promise<T> {
  const base = process.env.HAPPYVIEW_URL;
  if (!base) throw new Error("HAPPYVIEW_URL is not set");

  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    headers: {
      "X-Client-Key": process.env.HAPPYVIEW_CLIENT_KEY ?? "",
      "X-Client-Secret": process.env.HAPPYVIEW_CLIENT_SECRET ?? "",
    },
  });
  const body = (await response.json().catch(() => undefined)) as
    | (T & { error?: string; message?: string })
    | undefined;
  if (!response.ok || !body || body.error) {
    throw new Error(
      `HappyView ${path}: ${body?.message ?? body?.error ?? response.status}`,
    );
  }

  return body;
}

/**
 * Calls a HappyView query after the response has gone out, for work no visitor
 * should wait on, such as rebuilding a stale leaderboard. Failures are logged.
 */
export function happyviewInBackground(nsid: string, params: Params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const work = request(`/xrpc/${nsid}?${search}`).catch((error: unknown) =>
    console.error(`background ${nsid}`, error),
  );
  // Imported here so the module never reaches the client bundle.
  import("cloudflare:workers")
    .then(({ waitUntil }) => waitUntil(work))
    .catch(() => undefined);
}
