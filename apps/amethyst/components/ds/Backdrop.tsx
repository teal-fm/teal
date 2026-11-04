import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
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
  opacity: new Map<string, number>(),
  fill: new Map<string, number>(),
};

/** The blur hides detail, so the small thumbnail does, and feed covers share its cache. */
function thumbnail(uri: string) {
  return uri.replace(/front-(250|500|1200)$/, "front-250");
}

/** The next image to try after `failed`, mirroring Cover: release group, then the other size. */
async function fallbackFor(failed: string, original: string) {
  const release = original.match(/coverartarchive\.org\/release\/([^/]+)\//)?.[1];
  if (release && failed === thumbnail(original)) {
    const group = await getReleaseGroupCoverArtUrl(release, 250);
    if (group && group !== failed) return group;
  }
  const other = failed.replace(/front-250$/, "front-500");
  return other !== failed ? other : undefined;
}

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
  const resumed = remember ? (memory.opacity.get(shown.uri) ?? 0) : 0;
  const opacity = useSharedValue(resumed);
  const fill = useSharedValue(
    remember ? (memory.fill.get(shown.uri) ?? (solo ? 1 : 0)) : solo ? 1 : 0,
  );
  const [source, setSource] = useState(() => thumbnail(shown.uri));
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

  // Keep what's on screen at the moment of a remount, mid-fade included, so the
  // next mount carries on from there rather than from where the fade was heading.
  useEffect(() => {
    if (!remember) return;
    const uri = shown.uri;
    return () => {
      if (opacity.value > 0.01) {
        memory.opacity.set(uri, opacity.value);
        memory.fill.set(uri, fill.value);
      } else {
        memory.opacity.delete(uri);
        memory.fill.delete(uri);
      }
    };
  }, [remember, shown.uri, opacity, fill]);

  // Spot and full-window layers crossfade rather than resize, so nothing moves.
  useEffect(() => {
    fill.value = withTiming(solo ? 1 : 0, {
      duration: FADE_IN_MS,
      easing: ease,
      reduceMotion: ReduceMotion.Never,
    });
  }, [solo, fill]);

  const onError = () => {
    void fallbackFor(source, shown.uri).then((next) => {
      if (next) setSource(next);
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
