import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { getReleaseGroupCoverArtUrl } from "@/lib/teal/api";
import { useColorScheme } from "@/lib/useColorScheme";

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
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);

type Shown = { uri: string; weight: number; slot: number; since: number };

/**
 * The window backdrop's last state. Browser Back can rebuild the whole tree, and
 * without this the colour would cut to the plain ground and fade back from nothing.
 */
const memory = {
  shown: [] as Shown[],
  /**
   * Each cover's animated values. The rebuilt tree renders before the old one's
   * cleanups run, so it reads the old instance's values directly.
   */
  live: new Map<
    string,
    {
      opacity: SharedValue<number>;
      fill: SharedValue<number>;
      /** The image that loaded, which may be a fallback. */
      source: { current?: string };
    }
  >(),
};

/** The blur hides detail, so the small thumbnail does, and feed covers share its cache. */
function thumbnail(uri: string) {
  return uri.replace(/front-(250|500|1200)$/, "front-250");
}

/**
 * The next image to try after `failed`: the release group's cover, then the other
 * size. The group goes straight to 500, since the archive builds small thumbnails
 * lazily and they're the ones that time out.
 */
async function fallbackFor(failed: string, original: string, tried: Set<string>) {
  const release = original.match(/coverartarchive\.org\/release\/([^/]+)\//)?.[1];
  const group =
    release && failed === thumbnail(original)
      ? await getReleaseGroupCoverArtUrl(release, 500)
      : undefined;
  const otherSize = failed.replace(/front-(250|500)$/, (_, n) => `front-${n === "250" ? 500 : 250}`);
  const releaseLarge = thumbnail(original).replace(/front-250$/, "front-500");
  return [group, otherSize, releaseLarge].find((next) => next && !tried.has(next));
}

/** After every fallback fails, start over after these waits, so a flaky archive heals. */
const RETRY_MS = [1000, 4000, 15000, 60000];
/** How long a cover's state outlives it, enough for a rebuild but not a later visit. */
const RESUME_MS = 2000;

function Blob({
  shown,
  size,
  solo,
  hold,
  remember,
  dark,
  onLoaded,
  onGone,
}: {
  shown: Shown;
  size: number;
  /** The only cover in play, so it fills the whole window instead of one spot. */
  solo: boolean;
  /** Keep showing while it leaves, because nothing has loaded to replace it yet. */
  hold: boolean;
  remember: boolean;
  dark: boolean;
  onLoaded: (uri: string) => void;
  onGone: (uri: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [resumedFrom] = useState(() => {
    const previous = remember ? memory.live.get(shown.uri) : undefined;
    return (
      previous && {
        opacity: previous.opacity.value,
        fill: previous.fill.value,
        source: previous.source.current,
      }
    );
  });
  const resumed = resumedFrom?.opacity ?? 0;
  const opacity = useSharedValue(resumed);
  const fill = useSharedValue(resumedFrom?.fill ?? (solo ? 1 : 0));
  const [source, setSource] = useState(() => resumedFrom?.source ?? thumbnail(shown.uri));
  const loadedSource = useRef<string | undefined>(resumedFrom?.source);
  // A resumed cover was showing a moment ago, so its image is already in memory.
  const [loaded, setLoaded] = useState(resumed > 0);
  // Hold at nothing until the image is in, so a slow cover fades up instead of popping.
  const live = loaded ? Math.pow(shown.weight, 0.7) : 0;
  const shownAt = useRef(live);
  if (live > 0) shownAt.current = live;
  const leaving = shown.weight === 0;
  const target = leaving && hold ? shownAt.current : live;

  useEffect(() => {
    // An opacity crossfade moves nothing, so it runs even with Reduce Motion on;
    // jumping instead would flash the plain ground on every screen change.
    opacity.value = withTiming(target, {
      duration: target > 0 ? FADE_IN_MS : FADE_OUT_MS,
      easing: ease,
      reduceMotion: ReduceMotion.Never,
    });
    if (!leaving || hold) return;
    // Stay mounted until the fade-out finishes, so a cover never blinks away. The
    // margin covers the timer and the animation running on different clocks.
    const timer = setTimeout(() => onGone(shown.uri), FADE_OUT_MS + 250);
    return () => clearTimeout(timer);
  }, [target, leaving, hold, opacity, onGone, shown.uri]);

  // A remount picks up from these values, mid-fade included, rather than from
  // where the fade was heading. Soon after a cover goes, they're forgotten.
  useEffect(() => {
    if (!remember) return;
    const uri = shown.uri;
    const values = { opacity, fill, source: loadedSource };
    memory.live.set(uri, values);
    return () => {
      setTimeout(() => {
        if (memory.live.get(uri) === values) memory.live.delete(uri);
      }, RESUME_MS);
    };
  }, [remember, shown.uri, opacity, fill]);

  // Spot and full-window layers crossfade rather than resize, so nothing moves.
  useEffect(() => {
    // A leaving cover fades where it is, however long it's held.
    if (leaving) return;
    fill.value = withTiming(solo ? 1 : 0, {
      duration: FADE_IN_MS,
      easing: ease,
      reduceMotion: ReduceMotion.Never,
    });
  }, [solo, leaving, fill]);

  const [attempt, setAttempt] = useState(0);
  const tried = useRef(new Set<string>());
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (retry.current) clearTimeout(retry.current);
  }, []);
  const onError = () => {
    tried.current.add(source);
    void fallbackFor(source, shown.uri, tried.current).then((next) => {
      if (next) {
        setSource(next);
        return;
      }
      // Out of fallbacks: try the whole chain again later, a few times, in case
      // the archive is having a bad minute. A cover with no art stops here.
      if (retry.current || attempt >= RETRY_MS.length) return;
      retry.current = setTimeout(() => {
        retry.current = null;
        tried.current.clear();
        setSource(thumbnail(shown.uri));
        setAttempt((n) => n + 1);
      }, RETRY_MS[attempt]);
    });
  };

  const spotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * (1 - fill.value),
  }));
  const fullStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * fill.value,
  }));
  const [fx, fy] = SLOTS[shown.slot];
  const image = (onLoad?: () => void) => (
    <Image
      key={`${source}#${attempt}`}
      source={{ uri: source }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      cachePolicy="memory-disk"
      onLoad={onLoad}
      onError={onLoad ? onError : undefined}
    />
  );

  return (
    <>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: "hidden",
            left: fx * width - size / 2,
            top: fy * height - size / 2,
          },
          spotStyle,
        ]}
      >
        {image(() => {
          loadedSource.current = source;
          setLoaded(true);
          onLoaded(shown.uri);
        })}
      </Animated.View>
      {/* Overscanned so the blur doesn't fade the window's edges to the ground. */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: -width * 0.1,
            top: -height * 0.1,
            width: width * 1.2,
            height: height * 1.2,
          },
          fullStyle,
        ]}
      >
        {image()}
        {/* A cover filling the window needs a deeper veil than a few spots of it, so
            pale art can't wash out text in dark mode, or dark art in light mode. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.3)" },
          ]}
        />
      </Animated.View>
    </>
  );
}

const blurFilter =
  Platform.OS === "ios"
    ? "saturate(1.8)"
    : Platform.OS === "android"
      ? "blur(60px) saturate(1.8)"
      : "blur(56px) saturate(2)";

/**
 * A blend of the blurred covers currently on screen, behind everything else.
 * iOS blurs with a system material over the blobs; Android and the web blur the
 * blob layer itself. A fixed veil per theme keeps text readable on any cover.
 */
export function Backdrop({
  blobs,
  remember = false,
}: {
  blobs: AmbientBlob[];
  /** Resume from the last state after a remount. Only for the one window backdrop. */
  remember?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const { isDarkColorScheme } = useColorScheme();
  const size = Math.max(width, height) * (width >= 1000 ? 0.75 : 0.95);
  const [shown, setShown] = useState<Shown[]>(() => (remember ? memory.shown : []));
  const current = useRef<Shown[]>(shown);
  const [recheck, setRecheck] = useState(0);

  const commit = useCallback(
    (next: Shown[]) => {
      current.current = next;
      if (remember) memory.shown = next;
      setShown(next);
    },
    [remember],
  );

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
  const waitingFor =
    active.length > 0 && !active.some((item) => loadedUris.has(item.uri))
      ? active.map((item) => item.uri).join()
      : "";
  const [gaveUpOn, setGaveUpOn] = useState("");
  useEffect(() => {
    if (!waitingFor) {
      setGaveUpOn("");
      return;
    }
    const timer = setTimeout(() => setGaveUpOn(waitingFor), WAIT_FOR_ART_MS);
    return () => clearTimeout(timer);
  }, [waitingFor]);
  const hold = !!waitingFor && gaveUpOn !== waitingFor;

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
    <View
      pointerEvents="none"
      aria-hidden
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
      className="bg-ground"
    >
      <View style={[StyleSheet.absoluteFill, { filter: blurFilter } as object]}>
        {shown.map((item) => (
          <Blob
            key={item.uri}
            shown={item}
            size={size}
            solo={solo === item.uri}
            hold={hold}
            remember={remember}
            dark={isDarkColorScheme}
            onLoaded={loaded}
            onGone={forget}
          />
        ))}
      </View>
      {Platform.OS === "ios" && (
        <BlurView
          intensity={90}
          tint={isDarkColorScheme ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDarkColorScheme
              ? "rgba(0,0,0,0.42)"
              : "rgba(250,250,252,0.46)",
          },
        ]}
      />
    </View>
  );
}
