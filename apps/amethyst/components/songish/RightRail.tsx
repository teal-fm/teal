import { useEffect, useState } from "react";
import { View } from "react-native";
import type { ArtistView, ReleaseView } from "@teal/lexicons/src/types/fm/teal/alpha/stats/defs";
import { getTopArtists, getTopReleases } from "@/lib/teal/api";

import { Text } from "../ui/text";

export default function RightRail() {
  const [artists, setArtists] = useState<ArtistView[]>([]);
  const [releases, setReleases] = useState<ReleaseView[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([getTopArtists(3), getTopReleases(5)])
      .then(([artistRes, releaseRes]) => {
        if (!mounted) return;
        setArtists(artistRes.artists);
        setReleases(releaseRes.releases);
      })
      .catch(() => {
        if (!mounted) return;
        setArtists([]);
        setReleases([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View className="gap-10">
      <Text className="font-serif text-4xl font-black text-background dark:text-foreground">
        Featured Listeners
      </Text>
      <View className="items-center gap-1 py-12">
        <Text className="text-center text-3xl font-black text-background dark:text-foreground">
          {artists[0]?.name || "Teal listeners"}
        </Text>
        <Text className="text-center text-sm font-black text-background/80 dark:text-foreground/80">
          {artists[0]?.playCount ? `${artists[0].playCount} plays indexed` : "live from ATProto"}
        </Text>
      </View>
      <View className="rounded-2xl bg-background/65 p-5 backdrop-blur-xl">
        <Text className="mb-4 text-center font-serif text-3xl font-black">
          Trending Releases
        </Text>
        {releases.length === 0 ? (
          <Text className="text-center text-muted-foreground">Waiting for plays.</Text>
        ) : (
          releases.map((release) => (
            <View
              key={`${release.mbid}-${release.name}`}
              className="mb-3 flex-row justify-between gap-3 border-b border-border pb-3"
            >
              <Text className="min-w-0 flex-1 font-bold" numberOfLines={1}>
                {release.name}
              </Text>
              <Text className="font-mono text-sm text-muted-foreground">
                {release.playCount}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
