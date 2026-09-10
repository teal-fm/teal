import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Icon } from "@/lib/icons/iconWithClassName";
import { getTopArtists, getTopReleases } from "@/lib/teal/api";
import { musicArtistHref } from "@/lib/teal/routes";
import { ArrowUpRight, Radio } from "lucide-react-native";

import type {
  ArtistView,
  ReleaseView,
} from "@teal/lexicons/src/types/fm/teal/alpha/stats/defs";

import { Text } from "../ui/text";

export default function RightRail() {
  const [artists, setArtists] = useState<ArtistView[]>([]);
  const [releases, setReleases] = useState<ReleaseView[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([getTopArtists(4), getTopReleases(6)])
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
    <View className="gap-8">
      <View>
        <View className="mb-3 flex-row items-center gap-2">
          <Icon icon={Radio} size={14} className="text-primary" />
          <Text className="text-xs font-light text-primary">
            Trending now
          </Text>
        </View>
        <Text className="font-sans text-3xl font-semibold text-foreground">
          Live from the network
        </Text>
        <Text className="mt-2 text-sm leading-5 text-muted-foreground">
          Music activity indexed from Teal records across ATProto.
        </Text>
      </View>

      <View>
        <Text className="mb-3 text-xs font-light text-primary">
          Top artists
        </Text>
        {artists.map((artist, index) => (
          <Link
            key={`${artist.mbid}-${artist.name}`}
            href={musicArtistHref(artist.name || "Unknown", artist.mbid) as any}
            asChild
          >
            <Pressable className="flex-row items-center gap-3 border-t border-border py-3">
              <Text className="w-5 font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </Text>
              <View className="min-w-0 flex-1">
                <Text
                  className="text-sm font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {artist.name || "Unknown artist"}
                </Text>
                <Text className="font-mono text-[10px] text-muted-foreground">
                  {artist.playCount || 0} listens
                </Text>
              </View>
              <Icon
                icon={ArrowUpRight}
                size={14}
                className="text-primary"
              />
            </Pressable>
          </Link>
        ))}
      </View>

      <View>
        <Text className="mb-3 text-xs font-light text-primary">
          Releases
        </Text>
        {releases.length === 0 ? (
          <Text className="text-sm text-muted-foreground">
            Waiting for plays.
          </Text>
        ) : (
          releases.map((release, index) => (
            <View
              key={`${release.mbid}-${release.name}`}
              className="flex-row items-center gap-3 border-t border-border py-3"
            >
              <Text className="w-5 font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text
                className="min-w-0 flex-1 text-sm font-medium text-foreground"
                numberOfLines={1}
              >
                {release.name}
              </Text>
              <Text className="font-mono text-[10px] text-muted-foreground">
                {release.playCount}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
