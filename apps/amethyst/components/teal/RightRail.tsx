import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons/iconWithClassName";
import { getTopArtists, getTopReleases } from "@/lib/teal/api";
import { musicAlbumHref, musicArtistHref } from "@/lib/teal/routes";
import { ArrowUpRight } from "lucide-react-native";

import type {
  ArtistView,
  ReleaseView,
} from "@teal/lexicons/src/fm/teal/stats/defs";

import { Text } from "../ui/text";

export default function RightRail() {
  const [artists, setArtists] = useState<ArtistView[]>([]);
  const [releases, setReleases] = useState<ReleaseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [artistError, setArtistError] = useState(false);
  const [releaseError, setReleaseError] = useState(false);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setArtistError(false);
    setReleaseError(false);
    Promise.allSettled([getTopArtists(4), getTopReleases(6)]).then(
      ([artistResult, releaseResult]) => {
        if (!mounted) return;
        setArtistError(artistResult.status === "rejected");
        setReleaseError(releaseResult.status === "rejected");
        setArtists(
          artistResult.status === "fulfilled" ? artistResult.value.artists : [],
        );
        setReleases(
          releaseResult.status === "fulfilled"
            ? releaseResult.value.releases
            : [],
        );
        setLoading(false);
      },
    );
    return () => {
      mounted = false;
    };
  }, [request]);

  return (
    <View className="gap-6">
      <View>
        <Text
          role="heading"
          aria-level={2}
          className="font-sans text-2xl font-semibold"
        >
          Trending music
        </Text>
        <Text className="mt-2 text-sm leading-5 text-muted-foreground">
          What people are listening to across the Atmosphere.
        </Text>
      </View>
      {loading ? (
        <View className="items-center gap-3 py-8">
          <ActivityIndicator accessibilityLabel="Loading trending music" />
          <Text className="text-sm text-muted-foreground">
            Loading music activity…
          </Text>
        </View>
      ) : (
        <>
          {(artistError || releaseError) && (
            <View role="alert" className="gap-3 rounded-lg bg-muted p-4">
              <Text className="text-sm">
                Some trending music could not load.
              </Text>
              <Button
                variant="outline"
                onPress={() => setRequest((value) => value + 1)}
              >
                <Text>Try again</Text>
              </Button>
            </View>
          )}
          {!artistError && (
            <View>
              <Text
                role="heading"
                aria-level={3}
                className="mb-2 font-semibold"
              >
                Top artists
              </Text>
              {artists.length === 0 && (
                <Text className="text-sm text-muted-foreground">
                  No artist listens yet.
                </Text>
              )}
              {artists.map((artist, index) => (
                <Link
                  key={artist.mbid || artist.name}
                  href={
                    musicArtistHref(
                      artist.name || "Unknown",
                      artist.mbid,
                    ) as any
                  }
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`View ${artist.name || "artist"}`}
                    className="flex-row items-center gap-3 border-t border-border py-3 web:hover:bg-accent/40"
                  >
                    <Text className="w-5 text-xs text-muted-foreground">
                      {index + 1}
                    </Text>
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {artist.name || "Unknown artist"}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
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
          )}
          {!releaseError && (
            <View>
              <Text
                role="heading"
                aria-level={3}
                className="mb-2 font-semibold"
              >
                Albums
              </Text>
              {releases.length === 0 && (
                <Text className="text-sm text-muted-foreground">
                  No album listens yet.
                </Text>
              )}
              {releases.map((release, index) => (
                <Link
                  key={release.mbid || release.name}
                  href={
                    (release.mbid
                      ? musicAlbumHref(
                          "music",
                          release.name || "Unknown album",
                          release.mbid,
                        )
                      : "/search") as any
                  }
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`View ${release.name || "album"}`}
                    className="flex-row items-center gap-3 border-t border-border py-3 web:hover:bg-accent/40"
                  >
                    <Text className="w-5 text-xs text-muted-foreground">
                      {index + 1}
                    </Text>
                    <Text
                      className="min-w-0 flex-1 text-sm font-medium"
                      numberOfLines={1}
                    >
                      {release.name || "Unknown album"}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {release.playCount || 0}
                    </Text>
                    <Icon
                      icon={ArrowUpRight}
                      size={14}
                      className="text-primary"
                    />
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
