import { useEffect, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Icon } from "./Icon";
import { coverArtUrl, getReleaseGroupCoverArtUrl } from "@/lib/teal/api";
import { cn } from "@/lib/utils";
import { Disc3 } from "lucide-react-native";

export function coverUri(releaseMbId?: string, size = 500) {
  return coverArtUrl(releaseMbId, size);
}

/** Square release artwork, with a quiet disc placeholder when there is none. */
export function Cover({
  releaseMbId,
  uri,
  size,
  radius = 12,
  className,
  style,
  accessibilityLabel,
}: {
  releaseMbId?: string;
  uri?: string;
  size?: number;
  radius?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const artSize = size && size <= 250 ? 250 : 500;
  const primary = uri ?? coverUri(releaseMbId, artSize);
  // Some albums only have art on their release group, so a missing release cover
  // tries that next; with neither, the disc placeholder shows.
  const [fallback, setFallback] = useState<{ from: string; uri?: string }>();
  const [failed, setFailed] = useState<string[]>([]);
  const [retried, setRetried] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  // Settling on the disc isn't final: the archive fails in streaks, so the whole
  // chain runs again a little later, a couple of times.
  const restarts = useRef(0);
  const restart = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (restart.current) clearTimeout(restart.current);
  }, []);
  const source = primary && fallback?.from === primary ? fallback.uri : primary;
  const onError = () => {
    if (!source) return;
    // A release with no art of its own usually has it on its release group, so ask
    // for that first. Without one, or for any other image, retry once: the archive
    // redirects through archive.org and sometimes fails in passing.
    if (source === primary && !uri && releaseMbId && fallback?.from !== primary) {
      setFallback({ from: primary, uri: primary });
      void getReleaseGroupCoverArtUrl(releaseMbId, artSize).then((next) => {
        if (next && next !== primary) setFallback({ from: primary, uri: next });
        else retry(primary);
      });
      return;
    }
    retry(source);
  };
  const retry = (target: string) => {
    if (retried.includes(target)) {
      setFailed((current) => [...current, target]);
      // The archive's thumbnail sizes are separate files, so a size that keeps failing
      // can be swapped for the other before settling on the disc.
      const other = target.replace(/front-(250|500)$/, (_, n) => `front-${n === "250" ? 500 : 250}`);
      if (other !== target && !failed.includes(other)) {
        setFallback({ from: primary ?? target, uri: other });
      } else if (!restart.current && restarts.current < 2) {
        restart.current = setTimeout(() => {
          restart.current = null;
          restarts.current += 1;
          setFallback(undefined);
          setFailed([]);
          setRetried([]);
          setAttempt((n) => n + 1);
        }, 20000 * (restarts.current + 1));
      }
      return;
    }
    setRetried((current) => [...current, target]);
    setTimeout(() => setAttempt((n) => n + 1), 1200);
  };
  return (
    <View
      className={cn("aspect-square overflow-hidden bg-fill", className)}
      style={[{ borderRadius: radius }, size ? { width: size, height: size } : null, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "image" : undefined}
      // Unlabelled covers sit beside text that names the album, so they're decorative.
      aria-hidden={accessibilityLabel ? undefined : true}
    >
      {/* The disc sits underneath, so a cover that's loading or failing never leaves a hole. */}
      <View className="absolute inset-0 items-center justify-center">
        <Icon icon={Disc3} size={(size ?? 64) * 0.4} className="text-ink-3" />
      </View>
      {source && !failed.includes(source) ? (
        <Image
          key={`${source}#${attempt}`}
          onError={onError}
          source={{ uri: source }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={200}
          recyclingKey={source}
        />
      ) : null}
    </View>
  );
}
