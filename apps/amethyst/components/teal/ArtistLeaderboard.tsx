import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  actorAvatarUrl,
  actorProfileHref,
  displayActorName,
  getCachedBlueskyProfile,
  normalizeHandle,
  type DisplayActor,
} from "@/lib/teal/actors";
import type { ArtistListenerPeriod } from "@/lib/teal/api";
import { Headphones } from "lucide-react-native";
import { Icon } from "@/lib/icons/iconWithClassName";

import type { ArtistListenerView } from "@teal/lexicons/src/types/fm/teal/music/defs";

export const ARTIST_LISTENER_PERIODS: Array<{
  label: string;
  value: ArtistListenerPeriod;
}> = [
  { label: "All time", value: "all" },
  { label: "30 days", value: "30days" },
  { label: "7 days", value: "7days" },
];

export function normalizeArtistListenerPeriod(
  value: string | undefined,
): ArtistListenerPeriod {
  if (value === "30days" || value === "7days") return value;
  return "all";
}

export function ArtistListenerPeriodTabs({
  period,
  onChange,
}: {
  period: ArtistListenerPeriod;
  onChange: (period: ArtistListenerPeriod) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {ARTIST_LISTENER_PERIODS.map((item) => (
        <Button
          key={item.value}
          size="sm"
          variant={period === item.value ? "default" : "outline"}
          onPress={() => onChange(item.value)}
        >
          <Text>{item.label}</Text>
        </Button>
      ))}
    </View>
  );
}

export function ArtistListenerRow({
  listener,
  rank,
}: {
  listener: ArtistListenerView;
  rank: number;
}) {
  const [blueskyActor, setBlueskyActor] = useState<DisplayActor>();
  const indexedActor = listener.actor as DisplayActor;
  const did = indexedActor.did;
  const mergedActor = {
    ...blueskyActor,
    ...indexedActor,
    avatar: indexedActor.avatar || blueskyActor?.avatar,
    displayName: indexedActor.displayName || blueskyActor?.displayName,
    handle: indexedActor.handle || blueskyActor?.handle,
  };
  const href = actorProfileHref(mergedActor, did);
  const name = displayActorName(mergedActor, did);
  const handle = normalizeHandle(mergedActor.handle);
  const avatar = actorAvatarUrl(mergedActor, did);

  useEffect(() => {
    let mounted = true;
    if (!did || (indexedActor.displayName && indexedActor.handle)) {
      setBlueskyActor(undefined);
      return;
    }
    getCachedBlueskyProfile(did).then((profile) => {
      if (mounted) setBlueskyActor(profile);
    });
    return () => {
      mounted = false;
    };
  }, [did, indexedActor.displayName, indexedActor.handle]);

  return (
    <Link href={`/profile/${href}` as any} asChild>
      <Pressable className="flex-row items-center gap-3 border-b border-border/70 py-3 web:transition-colors web:hover:bg-primary/5">
        <View className="w-8 items-center">
          <Text className="font-mono text-xs font-bold text-muted-foreground">
            #{rank}
          </Text>
        </View>
        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-primary">
          {avatar ? (
            <Image source={{ uri: avatar }} className="h-full w-full" />
          ) : (
            <Text className="text-lg font-black text-primary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {name}
          </Text>
          {handle ? (
            <Text
              className="font-mono text-xs text-muted-foreground"
              numberOfLines={1}
            >
              @{handle}
            </Text>
          ) : (
            <Text
              className="font-mono text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {did}
            </Text>
          )}
        </View>
        <View className="min-w-[5.5rem] items-end">
          <View className="flex-row items-center gap-1">
            <Icon icon={Headphones} size={14} className="text-primary" />
            <Text className="font-sans text-lg font-black">
              {listener.playCount}
            </Text>
          </View>
          <Text className="font-mono text-[10px] uppercase text-muted-foreground">
            listens
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

export function ArtistLeaderboardList({
  listeners,
  offset = 0,
}: {
  listeners: ArtistListenerView[];
  offset?: number;
}) {
  return (
    <View className="overflow-hidden rounded-lg border border-border bg-card px-3">
      {listeners.map((listener, index) => (
        <ArtistListenerRow
          key={listener.actor.did || `${listener.actor.handle}-${index}`}
          listener={listener}
          rank={offset + index + 1}
        />
      ))}
    </View>
  );
}
