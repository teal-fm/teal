import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { useQueries } from "@tanstack/react-query";
import { getAlbum } from "@/lib/teal/api";
import { musicAlbumHref } from "@/lib/teal/routes";
import { AmbientSource, Cover, Glass, Text, coverUri } from "@/components/ds";

export type Favourite = { mbid: string; type: string };

export function favouriteId(item: Favourite) {
  return item.mbid.replace(/^mbid:/, "");
}

/** Up to four albums someone chose to define them, Letterboxd-style. */
export function Favourites({
  favourites,
  isSelf,
  onEdit,
}: {
  favourites: Favourite[];
  isSelf: boolean;
  onEdit?: () => void;
}) {
  const albums = useQueries({
    queries: favourites.map((f) => ({
      // Not ["album", …]: the album page keeps paged data under that key.
      queryKey: ["album-summary", favouriteId(f)],
      queryFn: () => getAlbum(`mbid:${favouriteId(f)}`, 1),
      staleTime: 60 * 60_000,
    })),
  });
  if (favourites.length === 0 && !isSelf) return null;

  return (
    <Glass className="gap-3 p-4">
      <View className="flex-row items-center justify-between">
        <Text role="heading" aria-level={2} className="text-[20px] font-bold text-ink">
          Favourites
        </Text>
        {isSelf && onEdit ? (
          <Pressable onPress={onEdit} accessibilityRole="button">
            <Text className="text-[15px] text-tint">{favourites.length ? "Edit" : "Choose"}</Text>
          </Pressable>
        ) : null}
      </View>
      {favourites.length === 0 ? (
        <Text className="text-[15px] text-ink-2">
          Pick four albums that say who you are. They sit at the top of your profile.
        </Text>
      ) : (
        <View className="flex-row gap-2.5">
          {favourites.map((f, i) => {
            const album = albums[i]?.data?.album;
            const id = favouriteId(f);
            const body = (
              <AmbientSource uri={coverUri(id)} className="flex-1">
                <Cover releaseMbId={id} radius={10} className="w-full shadow-lg" accessibilityLabel={album?.name} />
                <Text className="mt-1.5 text-[13px] font-semibold text-ink" numberOfLines={1}>
                  {album?.name ?? " "}
                </Text>
                <Text className="text-xs text-ink-2" numberOfLines={1}>
                  {album?.artistName ?? " "}
                </Text>
              </AmbientSource>
            );
            return album?.artistName ? (
              <Link key={id} href={musicAlbumHref(album.artistName, album.name, id) as never} asChild>
                <Pressable className="flex-1">{body}</Pressable>
              </Link>
            ) : (
              <View key={id} className="flex-1">
                {body}
              </View>
            );
          })}
          {/* Empty slots invite you to fill them, so only you see them. */}
          {Array.from({ length: isSelf ? 4 - favourites.length : 0 }, (_, i) => (
            <View key={`empty-${i}`} className="aspect-square flex-1 rounded-[10px] border border-dashed border-hair" />
          ))}
        </View>
      )}
    </Glass>
  );
}
