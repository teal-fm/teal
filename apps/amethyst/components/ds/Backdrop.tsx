import { useEffect, useRef } from "react";
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
  /** Vertical centre of the source in window coordinates. */
  cy: number;
};

// Covers take turns across three lanes so colour reaches both edges of wide screens.
const LANES = [0.1, 0.9, 0.5];
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function Blob({
  blob,
  lane,
  size,
}: {
  blob: AmbientBlob;
  lane: number;
  size: number;
}) {
  const { width, height } = useWindowDimensions();
  const opacity = useSharedValue(0);
  const x = useSharedValue((LANES[lane] + (hash(blob.uri) - 0.5) * 0.16) * width);
  const y = useSharedValue(height * 0.45);

  useEffect(() => {
    const mid = height * 0.45;
    opacity.value = withTiming(Math.pow(blob.weight, 0.7), {
      duration: 1000,
      easing: ease,
    });
    // Blobs ride along with their source at a slower, parallax pace.
    y.value = withTiming(mid + (blob.cy - mid) * 0.55, {
      duration: 1200,
      easing: ease,
    });
    x.value = withTiming(
      (LANES[lane] + (hash(blob.uri) - 0.5) * 0.16) * width,
      { duration: 1200, easing: ease },
    );
  }, [blob.weight, blob.cy, height, lane, width, blob.uri, opacity, x, y]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value - size / 2 },
      { translateY: y.value - size / 2 },
    ],
  }));

  return (
    <Animated.View
      style={[
        { position: "absolute", width: size, height: size, borderRadius: size / 2, overflow: "hidden" },
        style,
      ]}
    >
      <Image source={{ uri: blob.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
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
  const lanes = useRef(new Map<string, number>());
  const size = Math.max(width, height) * (width >= 1000 ? 0.75 : 0.95);

  for (const blob of blobs) {
    if (!lanes.current.has(blob.uri)) {
      lanes.current.set(blob.uri, lanes.current.size % LANES.length);
    }
  }

  return (
    <View
      pointerEvents="none"
      aria-hidden
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
      className="bg-ground"
    >
      <View style={[StyleSheet.absoluteFill, { filter: blurFilter } as object]}>
        {blobs.map((blob) => (
          <Blob
            key={blob.uri}
            blob={blob}
            lane={lanes.current.get(blob.uri) ?? 0}
            size={size}
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
              : "rgba(250,250,252,0.32)",
          },
        ]}
      />
    </View>
  );
}
