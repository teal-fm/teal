import { useState } from "react";
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
  const source = primary && fallback?.from === primary ? fallback.uri : primary;
  const onError = () => {
    if (!source) return;
    setFailed((current) => [...current, source]);
    if (source === primary && !uri && releaseMbId) {
      void getReleaseGroupCoverArtUrl(releaseMbId, artSize).then((next) =>
        setFallback({ from: source, uri: next !== source ? next : undefined }),
      );
    }
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
      {source && !failed.includes(source) ? (
        <Image
          onError={onError}
          source={{ uri: source }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={200}
          recyclingKey={source}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Icon icon={Disc3} size={(size ?? 64) * 0.4} className="text-ink-3" />
        </View>
      )}
    </View>
  );
}
