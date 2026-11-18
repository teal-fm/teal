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
