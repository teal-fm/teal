import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { create } from "zustand";

import { useBackdropPreferences } from "~/lib/backdrop";

import { Backdrop, type AmbientBlob } from "./Backdrop";

type AmbientApi = {
  register: (key: string, source: { uri: string; node: HTMLElement }) => void;
  unregister: (key: string) => void;
  /** Re-measure sources. Throttled. */
  refresh: () => void;
};

const AmbientContext = createContext<AmbientApi | null>(null);

/**
 * The backdrop spans the whole window, sidebar included, so the current page
 * publishes its blobs here and the shell draws them.
 */
const useWindowBackdrop = create<{ blobs: AmbientBlob[]; last: AmbientBlob[] }>(() => ({
  blobs: [],
  last: [],
}));

/** How strongly a page with no covers of its own keeps the colour it arrived with. */
const CARRIED = 0.5;

export function WindowBackdrop() {
  const blobs = useWindowBackdrop((state) => state.blobs);
  const last = useWindowBackdrop((state) => state.last);
  const off = useBackdropPreferences().preferences.backdrop === "off";
  // A page without covers, like Activity, dims the colour rather than draining it.
  // Turned off, it loads no covers at all.
  const shown = useMemo(
    () =>
      off ? [] : blobs.length ? blobs : last.map((blob) => ({ ...blob, weight: blob.weight * CARRIED })),
    [blobs, last, off],
  );
  return <Backdrop blobs={shown} />;
}

/** How many covers blend at once; more turns the backdrop to mud. */
const MAX_BLOBS = 6;
/** The nearest cover counts as at least this close, so a lone far one stays faint. */
const MIN_LEAD = 0.6;

function weightFor(top: number, bottom: number, height: number) {
  const mid = height * 0.45;
  return Math.max(0, 1 - Math.abs((top + bottom) / 2 - mid) / (height * 1.1));
}

/**
 * Hosts the blurred-cover backdrop for one page. Children mark covers with
 * `AmbientSource`; the page's scroll and resize re-measure them.
 */
export function AmbientScreen({ children }: { children: ReactNode }) {
  const sources = useRef(new Map<string, { uri: string; node: HTMLElement }>());
  const [blobs, setBlobs] = useState<AmbientBlob[]>([]);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    const height = window.innerHeight;
    const all = [...sources.current.values()];
    // A page with one cover in it, like an album or a listen, keeps that cover
    // at full strength however far it scrolls, so it can fill the backdrop.
    const uris = new Set(all.map((source) => source.uri));
    if (uris.size === 1) {
      const [uri] = uris;
      setBlobs((prev) => (prev.length === 1 && prev[0].uri === uri && prev[0].weight === 1 ? prev : [{ uri, weight: 1 }]));
      return;
    }
    const seen = new Map<string, AmbientBlob>();
    for (const source of all) {
      const rect = source.node.getBoundingClientRect();
      if (rect.height <= 0) continue;
      const weight = weightFor(rect.top, rect.bottom, height);
      const prev = seen.get(source.uri);
      if (weight > 0 && (!prev || prev.weight < weight)) seen.set(source.uri, { uri: source.uri, weight });
    }
    const top = [...seen.values()].sort((a, b) => b.weight - a.weight).slice(0, MAX_BLOBS);
    // Scale to the nearest cover, so a fast scroll between covers shifts the colour
    // instead of draining it.
    const scale = 1 / Math.max(top[0]?.weight ?? 1, MIN_LEAD);
    setBlobs(top.map((blob) => ({ ...blob, weight: Math.min(1, blob.weight * scale) })));
  }, []);

  const refresh = useCallback(() => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      measure();
    }, 80);
  }, [measure]);

  const api = useMemo<AmbientApi>(
    () => ({
      register: (key, source) => {
        sources.current.set(key, source);
        refresh();
      },
      unregister: (key) => {
        sources.current.delete(key);
        refresh();
      },
      refresh,
    }),
    [refresh],
  );

  useEffect(() => {
    // Capture catches horizontal shelves scrolling as well as the page.
    window.addEventListener("scroll", refresh, { passive: true, capture: true });
    window.addEventListener("resize", refresh, { passive: true });
    refresh();
    return () => {
      window.removeEventListener("scroll", refresh, { capture: true });
      window.removeEventListener("resize", refresh);
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    useWindowBackdrop.setState(blobs.length ? { blobs, last: blobs } : { blobs });
  }, [blobs]);

  return <AmbientContext.Provider value={api}>{children}</AmbientContext.Provider>;
}

export function useAmbient() {
  return useContext(AmbientContext);
}

let nextKey = 0;

/** Marks a region whose cover feeds the backdrop while it is near the middle of the screen. */
export function AmbientSource({
  uri,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { uri?: string; children?: ReactNode }) {
  const ambient = useAmbient();
  const ref = useRef<HTMLDivElement>(null);
  const key = useRef(`ambient-${nextKey++}`).current;

  useEffect(() => {
    if (!ambient || !uri || !ref.current) return;
    ambient.register(key, { uri, node: ref.current });
    return () => ambient.unregister(key);
  }, [ambient, key, uri]);

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
