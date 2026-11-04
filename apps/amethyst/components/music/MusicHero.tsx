import type { ReactNode } from "react";
import { View } from "react-native";
import { AmbientSource, Cover, coverUri, Heading, Text } from "@/components/ds";

/**
 * The top of an artist, album, or song page: big artwork that tints the backdrop,
 * then the title and its context lines.
 */
export function MusicHero({
  releaseMbId,
  imageUri,
  round,
  title,
  lines,
  actions,
}: {
  releaseMbId?: string;
  /** Artwork that isn't a release cover, such as an artist photo. */
  imageUri?: string;
  round?: boolean;
  title: string;
  lines: ReactNode[];
  actions?: ReactNode;
}) {
  const ambient = imageUri ?? coverUri(releaseMbId);
  return (
    <View className="gap-5 sm:flex-row sm:items-end">
      <AmbientSource uri={ambient}>
        <Cover
          releaseMbId={imageUri ? undefined : releaseMbId}
          uri={imageUri}
          size={232}
          radius={round ? 116 : 16}
          className="shadow-2xl"
        />
      </AmbientSource>
      <View className="min-w-0 flex-1 gap-1">
        <Heading level={1} size="hero" onBackdrop numberOfLines={3}>
          {title}
        </Heading>
        {lines.map((line, i) =>
          typeof line === "string" ? (
            <Text key={i} onBackdrop className="text-[16px] text-ink-2">
              {line}
            </Text>
          ) : (
            <View key={i}>{line}</View>
          ),
        )}
        {actions ? <View className="mt-3 flex-row flex-wrap gap-2.5">{actions}</View> : null}
      </View>
    </View>
  );
}
