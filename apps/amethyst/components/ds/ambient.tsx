import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, useWindowDimensions, View, type ViewProps } from "react-native";
import { useIsFocused } from "expo-router";
import { create } from "zustand";

import { Backdrop, type AmbientBlob } from "./Backdrop";

type Measurable = Pick<View, "measureInWindow">;
type Source = { uri: string; node: Measurable };

type AmbientApi = {
  register: (key: string, source: Source) => void;
  unregister: (key: string) => void;
  /** Re-measure sources, e.g. after a scroll. Throttled. */
  refresh: () => void;
};

const AmbientContext = createContext<AmbientApi | null>(null);

/**
 * On the web the backdrop spans the whole window, sidebar included, so the focused
 * screen publishes its blobs here and the shell draws them. Native screens draw
 * their own, so a pushed page slides in with its own art.
 */
export const useWindowBackdrop = create<{ blobs: AmbientBlob[] }>(() => ({
  blobs: [],
}));
const windowBackdrop = Platform.OS === "web";

export function WindowBackdrop() {
  const blobs = useWindowBackdrop((state) => state.blobs);
  return <Backdrop blobs={blobs} />;
}

/** How many covers blend at once; more turns the backdrop to mud. */
const MAX_BLOBS = 6;

function weightFor(top: number, bottom: number, height: number) {
  const mid = height * 0.45;
  return Math.max(0, 1 - Math.abs((top + bottom) / 2 - mid) / (height * 1.1));
}

/**
 * Hosts the blurred-cover backdrop for one screen. Children mark covers with
 * `AmbientSource`; scrolling should call `refresh` (see `useAmbientScroll`).
 */
export function AmbientScreen({
  children,
  style,
  ...props
}: ViewProps & { children: ReactNode }) {
  const sources = useRef(new Map<string, Source>());
  const [blobs, setBlobs] = useState<AmbientBlob[]>([]);
  const focused = useIsFocused();
  const { height } = useWindowDimensions();
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(async () => {
    const seen = new Map<string, AmbientBlob>();
    await Promise.all(
      [...sources.current.values()].map(
        (source) =>
          new Promise<void>((resolve) => {
            source.node.measureInWindow((_x, y, _w, h) => {
              if (h > 0) {
                const weight = weightFor(y, y + h, height);
                const prev = seen.get(source.uri);
                if (weight > 0 && (!prev || prev.weight < weight)) {
                  seen.set(source.uri, { uri: source.uri, weight, cy: y + h / 2 });
                }
              }
              resolve();
            });
          }),
      ),
    );
    setBlobs(
      [...seen.values()].sort((a, b) => b.weight - a.weight).slice(0, MAX_BLOBS),
    );
  }, [height]);

  const refresh = useCallback(() => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      void measure();
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

  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current);
  }, []);

  useEffect(() => {
    if (windowBackdrop && focused) useWindowBackdrop.setState({ blobs });
  }, [blobs, focused]);

  useEffect(() => {
    if (focused) refresh();
  }, [focused, refresh]);

  return (
    <AmbientContext.Provider value={api}>
      <View style={[{ flex: 1 }, style]} {...props}>
        {!windowBackdrop && <Backdrop blobs={blobs} />}
        {children}
      </View>
    </AmbientContext.Provider>
  );
}

export function useAmbient() {
  return useContext(AmbientContext);
}

/** Pass to a ScrollView/FlatList `onScroll` so the backdrop follows the content. */
export function useAmbientScroll() {
  const ambient = useAmbient();
  return useCallback(() => ambient?.refresh(), [ambient]);
}

let nextKey = 0;

/** Marks a region whose cover feeds the backdrop while it is near the middle of the screen. */
export function AmbientSource({
  uri,
  children,
  ...props
}: ViewProps & { uri?: string; children?: ReactNode }) {
  const ambient = useAmbient();
  const ref = useRef<View>(null);
  const key = useRef(`ambient-${nextKey++}`).current;

  useEffect(() => {
    if (!ambient || !uri || !ref.current) return;
    ambient.register(key, { uri, node: ref.current });
    return () => ambient.unregister(key);
  }, [ambient, key, uri]);

  return (
    <View ref={ref} onLayout={() => ambient?.refresh()} {...props}>
      {children}
    </View>
  );
}
