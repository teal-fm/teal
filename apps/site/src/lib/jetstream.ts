/**
 * A browser connection to Bluesky's public Jetstream. HappyView only answers
 * queries, so anything live on the site comes from here. On failure the
 * socket backs off and moves to the next instance; while the tab is hidden it
 * closes, and it resumes from the last event it saw.
 */
const JETSTREAMS = [
  "wss://jetstream2.us-east.bsky.network",
  "wss://jetstream1.us-east.bsky.network",
  "wss://jetstream2.us-west.bsky.network",
  "wss://jetstream1.us-west.bsky.network",
];

export interface JetstreamEvent {
  did: string;
  time_us: number;
  kind: string;
  commit?: {
    operation: "create" | "update" | "delete";
    collection: string;
    rkey: string;
    record?: Record<string, unknown>;
  };
}

export type ConnectionState = "connecting" | "open" | "retrying";

function parse(data: unknown): JetstreamEvent | undefined {
  if (typeof data !== "string") return undefined;
  try {
    const event = JSON.parse(data) as JetstreamEvent;
    return typeof event.did === "string" && typeof event.time_us === "number"
      ? event
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Subscribes to commits in `collections` (from `dids` only, when given) and
 * returns a function that ends the subscription. `cursor` carries the resume
 * point across subscriptions, such as a pause and a resume.
 */
export function subscribe(options: {
  collections: string[];
  dids?: string[];
  cursor?: { current?: number };
  onCommit: (event: JetstreamEvent) => void;
  onState?: (state: ConnectionState) => void;
}): () => void {
  const cursor = options.cursor ?? {};
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let stopped = false;

  const connect = () => {
    if (stopped || document.hidden || socket) return;
    options.onState?.("connecting");
    const url = new URL("/subscribe", JETSTREAMS[attempt % JETSTREAMS.length]);
    for (const collection of options.collections) {
      url.searchParams.append("wantedCollections", collection);
    }
    for (const did of options.dids ?? []) {
      url.searchParams.append("wantedDids", did);
    }
    if (cursor.current) url.searchParams.set("cursor", String(cursor.current));

    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      options.onState?.("open");
    };
    ws.onmessage = (message) => {
      const event = parse(message.data);
      if (!event) return;
      cursor.current = event.time_us;
      if (event.kind === "commit" && event.commit) options.onCommit(event);
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = undefined;
      if (stopped || document.hidden) return;
      options.onState?.("retrying");
      attempt += 1;
      retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt));
    };
  };

  const disconnect = () => {
    clearTimeout(retry);
    const ws = socket;
    socket = undefined;
    ws?.close();
  };

  const onVisibility = () => {
    if (document.hidden) disconnect();
    else connect();
  };

  connect();
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    stopped = true;
    disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
