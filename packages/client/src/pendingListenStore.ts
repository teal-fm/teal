import { useEffect, useMemo, useSyncExternalStore } from "react";

import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import { clientConfig } from "./config";
import {
  createPendingListenStore,
  type ConfirmedListenWrite,
  type PendingListen,
} from "./teal/pendingListens";

const EMPTY: readonly PendingListen[] = [];
let instance: ReturnType<typeof createPendingListenStore> | undefined;

/** Created on first use, so it reads whatever storage the app configured at startup. */
function store() {
  if (!instance) {
    instance = createPendingListenStore(clientConfig().storage);
    void instance.hydrate();
  }
  return instance;
}
const subscribe = (listener: () => void) => store().subscribe(listener);
const snapshot = () => store().getSnapshot();

export function retainConfirmedListens(
  actor: string,
  writes: readonly ConfirmedListenWrite[],
) {
  try {
    store().addConfirmed(actor, writes);
  } catch {
    // The PDS write already succeeded. Do not invite a duplicate submission if
    // this device cannot retain the local readback cache.
    console.warn("Listens saved, but local pending-listen retention failed.");
  }
}

export function retireIndexedListens(
  actor: string,
  indexed: readonly Pick<PlayView, "uri" | "authorDid" | "cid">[],
) {
  store().retireIndexed(actor, indexed);
}

export function removePendingListens(actor: string, uris: readonly string[]) {
  store().removeConfirmed(actor, uris);
}

export function usePendingListens(
  actor?: string | null,
): readonly PendingListen[] {
  const pending = useSyncExternalStore(
    subscribe,
    snapshot,
    () => EMPTY,
  );
  useEffect(() => {
    if (!actor) return;
    store().prune();
    const interval = setInterval(() => store().prune(), 60_000);
    return () => clearInterval(interval);
  }, [actor]);
  return useMemo(
    () => pending.filter((entry) => entry.play.authorDid === actor),
    [actor, pending],
  );
}
