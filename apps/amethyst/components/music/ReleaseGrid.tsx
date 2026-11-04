import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import type { AlbumSummary } from "@teal/lexicons/src/fm/teal/music/defs";
import { countLabel } from "@/lib/teal/music";
import { musicAlbumHref } from "@/lib/teal/routes";
import { AmbientSource, Cover, coverUri, Text } from "@/components/ds";

/** A grid of releases, each tinting the backdrop as it scrolls past. */
export function ReleaseGrid({ releases }: { releases: readonly AlbumSummary[] }) {
  return (
    <View className="flex-row flex-wrap gap-x-[4%] gap-y-4">
      {releases.map((release) => (
        <Link key={release.mbid} href={musicAlbumHref(release.artistName, release.name, release.mbid) as never} asChild>
          <Pressable className="w-[48%] sm:w-[30%] web:hover:opacity-85">
            <AmbientSource uri={coverUri(release.mbid)}>
              <Cover releaseMbId={release.mbid} radius={14} className="w-full shadow-lg" />
            </AmbientSource>
            <Text className="mt-2 text-[15px] font-semibold" numberOfLines={2}>
              {release.name}
            </Text>
            <Text className="text-[13px] tabular-nums text-ink-2">{countLabel(release.playCount, "listen")}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
