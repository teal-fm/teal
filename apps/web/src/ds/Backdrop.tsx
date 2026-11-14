import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getReleaseGroupCoverArtUrl } from "@teal/client/teal/api";

export type AmbientBlob = {
  uri: string;
  /** 0..1, how close the cover's source is to the middle of the screen. */
  weight: number;
};

/**
 * Fixed spots, as fractions of the window, that covers take as they arrive.
 * The colour stays put while the page scrolls: following the content at any
 * other pace reads as the background swimming, which can make people queasy.
 */
const SLOTS: [number, number][] = [
  [0.15, 0.25],
  [0.85, 0.35],
  [0.5, 0.75],
  [0.1, 0.8],
  [0.9, 0.8],
  [0.5, 0.15],
  [0.3, 0.5],
  [0.7, 0.55],
];
// Leaving covers fade slower than new ones arrive, so a fast scroll hands colour
// over rather than washing out between covers.
const FADE_IN_MS = 900;
const FADE_OUT_MS = 1600;
/** A cover stays at least this long once it arrives, so a flick can't churn the set. */
const HOLD_MS = 700;
/** The longest leaving covers wait for an arriving one's image. */
const WAIT_FOR_ART_MS = 2000;
const EASE = "cubic-bezier(0.25, 0.1, 0.25, 1)";
/** After every fallback fails, start over after these waits, so a flaky archive heals. */
const RETRY_MS = [2000, 6000, 20000, 60000];

type Shown = { uri: string; weight: number; slot: number; since: number };

/** The blur hides detail, so the small thumbnail does, and feed covers share its cache. */
function thumbnail(uri: string) {
  return uri.replace(/front-(250|500|1200)$/, "front-250");
}

/**
 * The next image to try after `failed`: the release group's cover, then the other
 * size. The group goes straight to 500, since the archive builds small thumbnails
 * lazily and they're the ones that time out.
 */
async function fallbackFor(failed: string, original: string) {
  const release = original.match(/coverartarchive\.org\/release\/([^/]+)\//)?.[1];
  if (release && failed === thumbnail(original)) {
    const group = await getReleaseGroupCoverArtUrl(release, 500);
    if (group && group !== failed) return group;
  }
  const other = failed.replace(/front-(250|500)$/, (_, n) => `front-${n === "250" ? 500 : 250}`);
  return other !== failed && other !== thumbnail(original) ? other : undefined;
}

function useWindowSize() {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener("resize", listener);
      return () => window.removeEventListener("resize", listener);
    },
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => "0x0",
  )
    .split("x")
    .map(Number) as [number, number];
}

function Blob({
  shown,
  size,
  solo,
  hold,
  onLoaded,
  onGone,
}: {
  shown: Shown;
  size: number;
  /** The only cover in play, so it fills the whole window instead of one spot. */
  solo: boolean;
  /** Keep showing while it leaves, because nothing has loaded to replace it yet. */
  hold: boolean;
  onLoaded: (uri: string) => void;
  onGone: (uri: string) => void;
}) {
  const [width, height] = useWindowSize();
  const [source, setSource] = useState(() => thumbnail(shown.uri));
  const [loaded, setLoaded] = useState(false);
  // Hold at nothing until the image is in, so a slow cover fades up instead of popping.
  const live = loaded ? Math.pow(shown.weight, 0.7) : 0;
  const shownAt = useRef(live);
  if (live > 0) shownAt.current = live;
  const leaving = shown.weight === 0;
  const target = leaving && hold ? shownAt.current : live;
  // Fade in from nothing on mount: the first frame paints at 0, then the target applies.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const opacity = mounted ? target : 0;

  useEffect(() => {
    if (!leaving || hold) return;
    // Stay mounted until the fade-out finishes, so a cover never blinks away.
    const timer = setTimeout(() => onGone(shown.uri), FADE_OUT_MS + 250);
    return () => clearTimeout(timer);
  }, [leaving, hold, onGone, shown.uri]);

  const [attempt, setAttempt] = useState(0);
  const tried = useRef(new Set<string>());
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (retry.current) clearTimeout(retry.current);
    },
    [],
  );
  const onError = () => {
    tried.current.add(source);
    void fallbackFor(source, shown.uri).then((next) => {
      if (next && !tried.current.has(next)) {
        setSource(next);
        return;
      }
      // Out of fallbacks: try the whole chain again later rather than giving up.
      if (retry.current) return;
      retry.current = setTimeout(() => {
        retry.current = null;
        tried.current.clear();
        setSource(thumbnail(shown.uri));
        setAttempt((n) => n + 1);
      }, RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]);
    });
  };

  const transition = `opacity ${target > 0 ? FADE_IN_MS : FADE_OUT_MS}ms ${EASE}`;
  const fill = solo ? 1 : 0;
  const [fx, fy] = SLOTS[shown.slot];
  return (
    <>
      <div
        className="absolute overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          left: fx * width - size / 2,
          top: fy * height - size / 2,
          opacity: opacity * (1 - fill),
          transition,
        }}
      >
        <img
          key={`${source}#${attempt}`}
          src={source}
          alt=""
          decoding="async"
          className="size-full object-cover"
          onLoad={() => {
            setLoaded(true);
            onLoaded(shown.uri);
          }}
          onError={onError}
        />
      </div>
      {/* Overscanned so the blur doesn't fade the window's edges to the ground. */}
      <div
        className="absolute -inset-[10%]"
        style={{ opacity: opacity * fill, transition }}
      >
        {/* The same file as the spot above, so the browser serves it from cache. */}
        <img key={`${source}#${attempt}`} src={source} alt="" decoding="async" className="size-full object-cover" />
        {/* A cover filling the window needs a deeper veil than a few spots of it. */}
        <div className="absolute inset-0" style={{ background: "var(--veil-solo)" }} />
      </div>
    </>
  );
}

/**
 * A blend of the blurred covers currently on screen, fixed behind everything.
 * A veil per theme keeps text readable on any cover.
 */
export function Backdrop({ blobs }: { blobs: AmbientBlob[] }) {
  const [width, height] = useWindowSize();
  const size = Math.max(width, height) * (width >= 1000 ? 0.75 : 0.95);
  const [shown, setShown] = useState<Shown[]>([]);
  const current = useRef<Shown[]>(shown);
  const [recheck, setRecheck] = useState(0);

  const commit = useCallback((next: Shown[]) => {
    current.current = next;
    setShown(next);
  }, []);

  // Covers that drop out fade to nothing in their spot; new ones take the emptiest spot.
  useEffect(() => {
    const now = Date.now();
    const prev = current.current;
    const incoming = new Map(blobs.map((blob) => [blob.uri, blob.weight]));
    let wake = Infinity;
    const next = prev.map((item) => {
      const weight = incoming.get(item.uri);
      if (weight !== undefined) {
        return { ...item, weight, since: item.weight > 0 ? item.since : now };
      }
      if (item.weight > 0 && now - item.since < HOLD_MS) {
        wake = Math.min(wake, item.since + HOLD_MS);
        return item;
      }
      return { ...item, weight: 0 };
    });
    for (const blob of blobs) {
      if (prev.some((item) => item.uri === blob.uri)) continue;
      const crowd = SLOTS.map((_, index) => next.filter((item) => item.slot === index).length);
      const slot = crowd.indexOf(Math.min(...crowd));
      next.push({ uri: blob.uri, weight: blob.weight, slot, since: now });
    }
    commit(next);
    if (wake === Infinity) return;
    const timer = setTimeout(() => setRecheck((n) => n + 1), wake - now);
    return () => clearTimeout(timer);
  }, [blobs, recheck, commit]);

  const active = shown.filter((item) => item.weight > 0);
  const solo = active.length === 1 ? active[0].uri : undefined;

  // Leaving covers wait for an arriving one to load, up to a limit, so moving to a
  // screen whose art is still downloading doesn't drain the colour in between.
  const [loadedUris, setLoadedUris] = useState(() => new Set<string>());
  const waiting = active.length > 0 && !active.some((item) => loadedUris.has(item.uri));
  const [patient, setPatient] = useState(true);
  useEffect(() => {
    if (!waiting) return;
    setPatient(true);
    const timer = setTimeout(() => setPatient(false), WAIT_FOR_ART_MS);
    return () => clearTimeout(timer);
  }, [waiting]);
  const hold = waiting && patient;

  const loaded = useCallback((uri: string) => {
    setLoadedUris((prev) => (prev.has(uri) ? prev : new Set(prev).add(uri)));
  }, []);

  const forget = useCallback(
    (uri: string) => {
      commit(current.current.filter((item) => item.uri !== uri || item.weight > 0));
      setLoadedUris((prev) => {
        if (!prev.has(uri)) return prev;
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
    },
    [commit],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ground">
      <div className="absolute inset-0" style={{ filter: "blur(56px) saturate(2)" }}>
        {width > 0
          ? shown.map((item) => (
              <Blob
                key={item.uri}
                shown={item}
                size={size}
                solo={solo === item.uri}
                hold={hold}
                onLoaded={loaded}
                onGone={forget}
              />
            ))
          : null}
      </div>
      <div className="absolute inset-0" style={{ background: "var(--veil)" }} />
    </div>
  );
}
