import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { getProfileImageUrl } from "@teal/client/teal/actors";
import { cn } from "@teal/client/utils";

import { Text } from "./Text";

/** A round profile picture; falls back to the first letter of the name. */
export function Avatar({
  did,
  avatar,
  name,
  size = 40,
  listeningNow = false,
  className,
}: {
  did?: string;
  avatar?: string;
  name?: string;
  size?: number;
  /** Draws the teal "listening now" ring. */
  listeningNow?: boolean;
  className?: string;
}) {
  const uri = did ? getProfileImageUrl(did, avatar, "avatar") : undefined;
  const ring = listeningNow ? Math.max(2, Math.round(size / 24)) : 0;
  // Remember which image failed, so a new avatar URL gets its own chance.
  const [brokenUri, setBrokenUri] = useState<string>();
  return (
    <View
      className={cn("rounded-full", listeningNow && "bg-now", className)}
      style={{ width: size, height: size, padding: ring }}
      // Avatars are decorative: the name sits beside them, or the link around them carries a label.
      aria-hidden
    >
      <View className="flex-1 items-center justify-center overflow-hidden rounded-full border-ground bg-fill" style={{ borderWidth: ring ? ring : 0 }}>
        {/* The initial sits underneath, so a missing or broken image still shows who it is. */}
        <Text className="font-semibold text-ink-2" style={{ fontSize: size * 0.4 }}>
          {(name ?? "?").slice(0, 1).toUpperCase()}
        </Text>
        {uri && uri !== brokenUri ? (
          <Image
            source={{ uri }}
            style={{ position: "absolute", width: "100%", height: "100%" }}
            contentFit="cover"
            onError={() => setBrokenUri(uri)}
          />
        ) : null}
      </View>
    </View>
  );
}
