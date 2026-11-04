import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
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
const FADE_MS = 1200;
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 4294967296;
}

type Shown = { uri: string; weight: number; slot: number };

function Blob({
  shown,
  size,
  onGone,
}: {
  shown: Shown;
  size: number;
  onGone: (uri: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const opacity = useSharedValue(0);
  const target = Math.pow(shown.weight, 0.7);

  useEffect(() => {
    opacity.value = withTiming(target, { duration: FADE_MS, easing: ease });
    if (target > 0) return;
    // Stay mounted until the fade-out finishes, so a cover never blinks away.
    const timer = setTimeout(() => onGone(shown.uri), FADE_MS);
    return () => clearTimeout(timer);
  }, [target, opacity, onGone, shown.uri]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const [fx, fy] = SLOTS[shown.slot];

  return (
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
        style,
      ]}
    >
      <Image
        source={{ uri: shown.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </Animated.View>
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
export function Backdrop({ blobs }: { blobs: AmbientBlob[] }) {
  const { width, height } = useWindowDimensions();
  const { isDarkColorScheme } = useColorScheme();
  const size = Math.max(width, height) * (width >= 1000 ? 0.75 : 0.95);
  const [shown, setShown] = useState<Shown[]>([]);

  // Covers that drop out fade to nothing in their spot; new ones take a free spot.
  useEffect(() => {
    setShown((prev) => {
      const incoming = new Map(blobs.map((blob) => [blob.uri, blob.weight]));
      const next = prev.map((item) => ({
        ...item,
        weight: incoming.get(item.uri) ?? 0,
      }));
      const used = new Set(next.map((item) => item.slot));
      for (const blob of blobs) {
        if (prev.some((item) => item.uri === blob.uri)) continue;
        let slot = SLOTS.findIndex((_, index) => !used.has(index));
        if (slot < 0) slot = Math.floor(hash(blob.uri) * SLOTS.length);
        used.add(slot);
        next.push({ uri: blob.uri, weight: blob.weight, slot });
      }
      return next;
    });
  }, [blobs]);

  const forget = useCallback((uri: string) => {
    setShown((prev) =>
      prev.filter((item) => item.uri !== uri || item.weight > 0),
    );
  }, []);

  return (
    <View
      pointerEvents="none"
      aria-hidden
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
      className="bg-ground"
    >
      <View style={[StyleSheet.absoluteFill, { filter: blurFilter } as object]}>
        {shown.map((item) => (
          <Blob key={item.uri} shown={item} size={size} onGone={forget} />
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
