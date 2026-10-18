import { useEffect, useMemo, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import {
  createPendingListenStore,
  type ConfirmedListenWrite,
  type PendingListen,
} from "../lib/teal/pendingListens";

const pendingListenStore = createPendingListenStore(AsyncStorage);
const EMPTY: readonly PendingListen[] = [];
void pendingListenStore.hydrate();

export function retainConfirmedListens(
  actor: string,
  writes: readonly ConfirmedListenWrite[],
) {
  try {
    pendingListenStore.addConfirmed(actor, writes);
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
  pendingListenStore.retireIndexed(actor, indexed);
}

export function removePendingListens(actor: string, uris: readonly string[]) {
  pendingListenStore.removeConfirmed(actor, uris);
}

export function usePendingListens(
  actor?: string | null,
): readonly PendingListen[] {
  const pending = useSyncExternalStore(
    pendingListenStore.subscribe,
    pendingListenStore.getSnapshot,
    () => EMPTY,
  );
  useEffect(() => {
    if (!actor) return;
    pendingListenStore.prune();
    const interval = setInterval(() => pendingListenStore.prune(), 60_000);
    return () => clearInterval(interval);
  }, [actor]);
  return useMemo(
    () => pending.filter((entry) => entry.play.authorDid === actor),
    [actor, pending],
  );
}
