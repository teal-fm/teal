import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import RightRail from "@/components/songish/RightRail";
import SongishShell from "@/components/songish/SongishShell";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { coverArtUrl, getArtist } from "@/lib/teal/api";
import { musicAlbumHref } from "@/lib/teal/routes";
import { ChevronRight, Disc3, Mic2 } from "lucide-react-native";

import type { ArtistView } from "@teal/lexicons/src/types/fm/teal/alpha/music/defs";

export default function ArtistDetail() {
  const params = useLocalSearchParams();
  const mbid = Array.isArray(params.mbid) ? params.mbid[0] : params.mbid;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const [artist, setArtist] = useState<ArtistView | null>(null);
  const [error, setError] = useState<string>();
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    getArtist(mbid, name)
      .then(({ artist }) => {
        if (mounted) setArtist(artist);
      })
      .catch((loadError) => {
        if (mounted) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, [mbid, name]);

  const representativeArt = artFailed
    ? undefined
    : coverArtUrl(artist?.albums[0]?.mbid, 500);

  return (
    <SongishShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{ title: artist?.name || "Artist", headerShown: false }}
      />
      {!artist && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="rounded-2xl bg-destructive/15 p-4">
          <Text className="font-bold text-destructive">
            Could not load artist: {error}
          </Text>
        </View>
      )}
      {artist && (
        <>
          <View className="mb-10 overflow-hidden rounded-2xl bg-background/75">
            <View className="h-40 bg-muted">
              {representativeArt && (
                <Image
                  source={{ uri: representativeArt }}
                  className="h-full w-full opacity-40"
                  onError={() => setArtFailed(true)}
                />
              )}
            </View>
            <View className="-mt-10 flex-row items-end gap-4 px-5 pb-7">
              <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-muted md:h-28 md:w-28">
                {representativeArt ? (
                  <Image
                    source={{ uri: representativeArt }}
                    className="h-full w-full"
                    onError={() => setArtFailed(true)}
                  />
                ) : (
                  <Icon
                    icon={Mic2}
                    size={42}
                    className="text-muted-foreground"
                  />
                )}
              </View>
              <View className="min-w-0 flex-1 pb-1">
                <Text className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  Artist
                </Text>
                <Text
                  className="font-serif text-2xl font-black"
                  numberOfLines={3}
                >
                  {artist.name}
                </Text>
                <Text className="font-mono text-xs text-muted-foreground">
                  {artist.playCount} indexed listens
                </Text>
              </View>
            </View>
          </View>

          <Text className="mb-4 text-2xl font-black">Discography</Text>
          <View className="overflow-hidden rounded-2xl bg-background/75 px-4">
            {artist.albums.map((album) => {
              const art = coverArtUrl(album.mbid);
              return (
                <Link
                  key={album.mbid}
                  href={
                    musicAlbumHref(
                      album.artistName,
                      album.name,
                      album.mbid,
                    ) as any
                  }
                  asChild
                >
                  <Pressable className="flex-row items-center gap-3 border-b border-border/70 py-4">
                    <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {art ? (
                        <Image
                          source={{ uri: art }}
                          className="h-full w-full"
                        />
                      ) : (
                        <Icon
                          icon={Disc3}
                          size={26}
                          className="text-muted-foreground"
                        />
                      )}
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-black" numberOfLines={2}>
                        {album.name}
                      </Text>
                      <Text className="font-mono text-xs text-muted-foreground">
                        {album.playCount} listens
                      </Text>
                    </View>
                    <Icon
                      icon={ChevronRight}
                      size={18}
                      className="text-muted-foreground"
                    />
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </>
      )}
    </SongishShell>
  );
}
