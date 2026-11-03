import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Icon } from "@/lib/icons/iconWithClassName";
import { coverArtUrl } from "@/lib/teal/api";
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
  const source = uri ?? coverUri(releaseMbId, size && size <= 250 ? 250 : 500);
  // The Cover Art Archive has no art for some releases; fall back to the disc.
  const [failed, setFailed] = useState<string | undefined>();
  return (
    <View
      className={cn("aspect-square overflow-hidden bg-fill", className)}
      style={[{ borderRadius: radius }, size ? { width: size, height: size } : null, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "image" : undefined}
    >
      {source && failed !== source ? (
        <Image
          onError={() => setFailed(source)}
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
