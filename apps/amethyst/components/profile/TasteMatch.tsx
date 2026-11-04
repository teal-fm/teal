import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getTasteMatch } from "@/lib/teal/api";
import { musicAlbumHref } from "@/lib/teal/routes";
import { ChevronRight } from "lucide-react-native";
import { Avatar, Cover, Glass, Icon, Text } from "@/components/ds";

const LEVEL = { high: "Very in tune", some: "Some overlap", low: "Different tastes" } as const;

/** How the viewer's listening overlaps with someone else's. */
export function TasteMatch({
  actor,
  viewer,
  name,
  avatars,
}: {
  actor: string;
  viewer: string;
  name: string;
  avatars: { viewer?: { did: string; avatar?: string }; actor?: { did: string; avatar?: string } };
}) {
  const match = useQuery({
    queryKey: ["taste", actor, viewer],
    queryFn: () => getTasteMatch(actor, viewer),
    staleTime: 10 * 60_000,
  });
  const data = match.data;
  if (!data || data.topArtistCount === 0) return null;
  const s = data.suggestion;

  return (
    <Glass className="gap-3.5 p-4">
      <Text role="heading" aria-level={2} className="text-[20px] font-bold text-ink">
        You and {name}
      </Text>
      <View className="flex-row items-center gap-3.5">
        <View className="flex-row">
          <Avatar did={avatars.viewer?.did} avatar={avatars.viewer?.avatar} size={44} />
          <View style={{ marginLeft: -14 }}>
            <Avatar did={avatars.actor?.did} avatar={avatars.actor?.avatar} name={name} size={44} />
          </View>
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <View className="self-start rounded-full bg-tint-soft px-2.5 py-0.5">
            <Text className="text-[13.5px] font-bold text-tint">{LEVEL[data.level]}</Text>
          </View>
          <Text className="text-[15px] text-ink-2">
            <Text className="font-semibold text-ink">
              {data.sharedArtistCount} of your top {data.topArtistCount} artists
            </Text>{" "}
            {data.sharedArtistCount === 1 ? "is" : "are"} in {name}'s too.
          </Text>
        </View>
      </View>
      {data.sharedArtists.length > 0 ? (
        <>
          <Text className="-mb-1.5 text-[15px] text-ink-2">You both love</Text>
          <View className="flex-row gap-2.5">
            {data.sharedArtists.slice(0, 4).map((artist) => (
              <View key={artist.name} className="flex-1">
                <Cover releaseMbId={artist.releaseMbId} radius={9} className="w-full" accessibilityLabel={artist.releaseName} />
                <Text className="mt-1.5 text-[13px] font-semibold text-ink" numberOfLines={1}>
                  {artist.name}
                </Text>
              </View>
            ))}
            {Array.from({ length: Math.max(0, 4 - data.sharedArtists.length) }, (_, i) => (
              <View key={i} className="flex-1" />
            ))}
          </View>
        </>
      ) : null}
      {s?.releaseMbId ? (
        <Link
          href={(s.artistName ? musicAlbumHref(s.artistName, s.releaseName, s.releaseMbId) : "/") as never}
          asChild
        >
          <Pressable className="flex-row items-center gap-3 rounded-[14px] border border-hair p-3">
            <Cover releaseMbId={s.releaseMbId} size={56} radius={8} />
            <Text className="flex-1 text-[14.5px] text-ink-2">
              <Text className="font-semibold text-ink">{s.releaseName}</Text> is {name}'s #{s.rank} this month, and
              you've never played it.
            </Text>
            <Icon icon={ChevronRight} size={18} className="text-ink-3" />
          </Pressable>
        </Link>
      ) : null}
    </Glass>
  );
}
