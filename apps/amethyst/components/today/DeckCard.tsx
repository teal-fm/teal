import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Link } from "expo-router";
import type { ListeningView, MomentView } from "@/lib/teal/api";
import { useToggleReaction, useViewerDid } from "@/lib/teal/queries";
import { QUICK_REACTIONS } from "@/lib/teal/reactions";
import { musicAlbumHref } from "@/lib/teal/routes";
import { listeningFact, momentLabel, momentLine, shortAgo } from "@/lib/teal/today";
import { cn } from "@/lib/utils";
import { Compass, SmilePlus, TrendingUp } from "lucide-react-native";
import { Avatar, Cover, Icon, Text, useHalo } from "@/components/ds";

import { ReactionPicker } from "./ReactionPicker";

export type DeckItem =
  | { kind: "listen"; key: string; listen: ListeningView }
  | { kind: "moment"; key: string; moment: MomentView };

function Stickers({ reactions }: { reactions: ListeningView["reactions"] }) {
  return (
    <View className="absolute bottom-2.5 right-2.5 flex-row-reverse" pointerEvents="none">
      {reactions.slice(0, 4).map((r) => (
        <Animated.View
          key={r.emoji}
          entering={ZoomIn.springify().damping(9)}
          className="-ml-3 h-11 w-11 items-center justify-center rounded-full bg-ground shadow-lg"
        >
          <Text className="text-[23px]">{r.emoji}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

function ListeningCard({ listen, width }: { listen: ListeningView; width: number }) {
  const viewer = useViewerDid();
  const toggle = useToggleReaction();
  const [picking, setPicking] = useState(false);
  const lastTap = useRef(0);
  const subject = { uri: listen.playUri, cid: listen.playCid };
  const actor = listen.actor;
  const name = actor?.displayName || actor?.handle || "Someone";
  const fact = listeningFact(listen);
  const halo = useHalo();

  const react = (emoji: string) => {
    if (!viewer) return;
    const existing = listen.reactions.find((r) => r.emoji === emoji)?.viewerReaction;
    toggle.mutate({ subject, emoji, existing: existing === "pending" ? undefined : existing });
  };
  // Double-tap the cover for 🔥: the fastest way to say "yes, this".
  const onCoverPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      react("🔥");
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View style={{ width }}>
      <Pressable
        onPress={onCoverPress}
        onLongPress={() => viewer && setPicking(true)}
        accessibilityLabel={`${name} is playing ${listen.trackName}${listen.artistName ? ` by ${listen.artistName}` : ""}. Double tap to react with fire.`}
      >
        <Cover releaseMbId={listen.releaseMbId} radius={18} style={{ width, height: width }} className="shadow-2xl" />
        <Link href={`/profile/${actor?.did}`} asChild>
          <Pressable className="absolute left-2.5 top-2.5 h-[34px] flex-row items-center gap-2 rounded-full bg-black/45 pl-[3px] pr-3">
            <Avatar did={actor?.did} avatar={actor?.avatar} name={name} size={28} />
            <Text className="text-[13.5px] font-semibold text-white" numberOfLines={1}>
              {name}
            </Text>
            {listen.listeningNow ? (
              <View className="h-[7px] w-[7px] rounded-full bg-now" accessibilityLabel="listening now" />
            ) : null}
            <Text className="text-[12.5px] text-white/80">
              {listen.listeningNow ? "now" : shortAgo(listen.playedTime)}
            </Text>
          </Pressable>
        </Link>
        <Stickers reactions={listen.reactions} />
      </Pressable>
      <View className="mt-3 gap-0.5">
        <Text style={halo} className="text-[19px] font-bold text-ink" numberOfLines={1}>
          {listen.trackName}
        </Text>
        <Text style={halo} className="text-[15px] text-ink-2" numberOfLines={1}>
          {[listen.artistName, listen.releaseName].filter(Boolean).join(" · ")}
        </Text>
        {fact ? (
          <Text style={halo} className="mt-1.5 text-[15px] text-ink-2" numberOfLines={2}>
            {fact}
          </Text>
        ) : null}
      </View>
      {viewer ? (
        <View className="-ml-1.5 mt-2 flex-row">
          {QUICK_REACTIONS.map((emoji) => {
            const mine = listen.reactions.some((r) => r.emoji === emoji && r.viewerReaction);
            return (
              <Pressable
                key={emoji}
                onPress={() => react(emoji)}
                accessibilityLabel={`React ${emoji}`}
                accessibilityState={{ selected: mine }}
                className={cn(
                  "h-10 w-10 items-center justify-center rounded-full active:scale-75",
                  mine && "bg-fill",
                )}
              >
                <Text className="text-[22px]">{emoji}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityLabel="Any emoji"
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Icon icon={SmilePlus} size={21} className="text-ink-2" />
          </Pressable>
          <ReactionPicker visible={picking} onPick={react} onClose={() => setPicking(false)} />
        </View>
      ) : null}
    </View>
  );
}

function MomentCard({ moment, width }: { moment: MomentView; width: number }) {
  const { release } = moment;
  const halo = useHalo();
  const href =
    release.releaseMbId && release.artistName
      ? musicAlbumHref(release.artistName, release.releaseName, release.releaseMbId)
      : undefined;
  const chip =
    moment.kind === "mutuals" || moment.kind === "circle" ? (
      <View className="flex-row">
        {moment.listeners.slice(0, 3).map((p, i) => (
          <View key={p.did} style={{ marginLeft: i ? -8 : 0 }}>
            <Avatar did={p.did} avatar={p.avatar} name={p.displayName ?? p.handle} size={24} />
          </View>
        ))}
      </View>
    ) : (
      <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-tint">
        <Icon icon={moment.kind === "trending" ? TrendingUp : Compass} size={15} className="text-on-tint" />
      </View>
    );

  return (
    <View style={{ width }}>
      <View>
        <Cover
          releaseMbId={release.releaseMbId}
          radius={18}
          style={{ width, height: width }}
          className="border-2 border-tint/70 shadow-2xl"
          accessibilityLabel={`${release.releaseName} cover`}
        />
        <View className="absolute left-2.5 top-2.5 h-[34px] flex-row items-center gap-2 rounded-full bg-black/45 pl-1 pr-3">
          {chip}
          <Text className="text-[13.5px] font-semibold text-white">{momentLabel(moment)}</Text>
        </View>
      </View>
      <View className="mt-3 gap-0.5">
        <Text style={halo} className="text-[19px] font-bold text-ink" numberOfLines={1}>
          {release.releaseName}
        </Text>
        {release.artistName ? (
          <Text style={halo} className="text-[15px] text-ink-2" numberOfLines={1}>
            {release.artistName}
          </Text>
        ) : null}
        <Text style={halo} className="mt-1.5 text-[15px] text-ink-2" numberOfLines={2}>
          {momentLine(moment)}
        </Text>
      </View>
      {href ? (
        <Link href={href as never} asChild>
          <Pressable className="mt-3 h-9 self-start justify-center rounded-full bg-fill px-3.5">
            <Text className="text-[14.5px] font-semibold text-ink">See who's listening</Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

export function DeckCard({ item, width }: { item: DeckItem; width: number }) {
  return item.kind === "listen" ? (
    <ListeningCard listen={item.listen} width={width} />
  ) : (
    <MomentCard moment={item.moment} width={width} />
  );
}

/** Friends who are listening come first; group moments are slotted in between them. */
export function deckItems(listening: ListeningView[], moments: MomentView[]): DeckItem[] {
  const items: DeckItem[] = listening.map((listen) => ({
    kind: "listen",
    key: listen.playUri,
    listen,
  }));
  moments.forEach((moment, i) => {
    const at = Math.min(items.length, 1 + i * 3);
    items.splice(at, 0, {
      kind: "moment",
      key: `${moment.kind}-${moment.release.releaseMbId ?? moment.release.releaseName}`,
      moment,
    });
  });
  return items;
}
