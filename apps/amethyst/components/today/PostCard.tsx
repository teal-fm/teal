import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Link } from "expo-router";
import RichText from "@/components/post/RichText";
import type { SocialPostView } from "@teal/client/teal/api";
import { absoluteUrl, musicArtistHref, postHrefFromUri } from "@teal/client/teal/routes";
import { shareLink } from "@/lib/teal/share";
import { trackViewToPlayView } from "@teal/client/teal/social";
import { shortAgo } from "@teal/client/teal/today";
import { ArrowUpRight, MessageCircle, Share as ShareIcon } from "lucide-react-native";
import { AmbientSource, Avatar, Cover, Glass, Icon, Text, coverUri } from "@/components/ds";

import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";

import { ReactionBar } from "./ReactionBar";

function contextLine(post: SocialPostView) {
  const c = post.listenContext;
  if (!c) return undefined;
  if (c.circleListenerCount > 0) {
    const named = c.circleSample.map((p) => p.displayName || p.handle).filter(Boolean).slice(0, 2);
    const others = c.circleListenerCount - named.length;
    const who = others > 0 ? `${named.join(", ")} and ${others} other${others === 1 ? "" : "s"}` : named.join(" and ");
    return `${who || `${c.circleListenerCount} people you follow`} played this today`;
  }
  if (c.viewerPlayCount) return `You've played this ${c.viewerPlayCount} time${c.viewerPlayCount === 1 ? "" : "s"}`;
  if (c.authorPlayCount && c.authorPlayCount > 1) return `${c.authorPlayCount} plays from ${post.author?.displayName || "them"}`;
  return undefined;
}

/** A song post: what someone said, the song beside it, and how your circle met it. */
export function PostCard({ post }: { post: SocialPostView }) {
  const play = trackViewToPlayView(post.track);
  const author = useDisplayActor(post.author, post.authorDid);
  const name = author.name;
  // Fall back to the generic AT URI route when a post URI doesn't parse into a post route.
  const href = postHrefFromUri(post.uri) ?? `/at:/${post.uri.replace(/^at:\/\//, "")}`;
  const artist = play.artists?.[0]?.artistName;
  const context = contextLine(post);
  const faces = post.listenContext?.circleSample ?? [];
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const result = await shareLink(`${post.text ? `${post.text} ` : ""}${play.trackName}`, absoluteUrl(href));
    if (result !== "copied") return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AmbientSource uri={coverUri(play.releaseMbId)}>
      <Glass className="mb-3.5 gap-3 px-4 pb-3 pt-4">
        <View className="flex-row items-center gap-2.5">
          <Link href={author.href as never} asChild>
            <Pressable accessibilityLabel={name ? `${name}'s profile` : "Profile"}>
              <Avatar did={author.did} avatar={author.avatar} name={name} size={40} />
            </Pressable>
          </Link>
          <View className="min-w-0 flex-1">
            <Text className="text-[15.5px] font-semibold text-ink" numberOfLines={1}>
              {name}
              {author.handle && author.handle !== name ? (
                <Text className="text-sm font-normal text-ink-2"> @{author.handle}</Text>
              ) : null}
            </Text>
          </View>
          <Text className="text-sm text-ink-2">{shortAgo(post.createdAt)}</Text>
        </View>

        {post.text ? (
          <Link href={href as never} asChild>
            <Pressable>
              <RichText
                text={post.text}
                facets={post.facets}
                className="text-[20px] font-medium leading-[26px] tracking-tight text-ink"
              />
            </Pressable>
          </Link>
        ) : null}

        <View className="flex-row items-center gap-3.5">
          <Link href={href as never} asChild>
            <Pressable accessibilityLabel={`${play.trackName}${artist ? ` by ${artist}` : ""}`}>
              <Cover releaseMbId={play.releaseMbId} size={112} radius={14} className="shadow-xl" />
            </Pressable>
          </Link>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-[17px] font-semibold text-ink" numberOfLines={1}>
              {play.trackName}
            </Text>
            {artist ? (
              <Link href={musicArtistHref(artist, play.artists?.[0]?.artistMbId) as never} asChild>
                <Pressable>
                  <Text className="text-[15px] text-ink-2" numberOfLines={1}>
                    {[artist, play.releaseName].filter(Boolean).join(" · ")}
                  </Text>
                </Pressable>
              </Link>
            ) : null}
            {context ? (
              <View className="mt-2 flex-row items-center gap-2">
                {faces.length > 0 ? (
                  <View className="flex-row">
                    {faces.map((p, i) => (
                      <View key={p.did} style={{ marginLeft: i ? -7 : 0 }}>
                        <Avatar did={p.did} avatar={p.avatar} name={p.displayName ?? p.handle} size={22} />
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text className="flex-1 text-[13px] text-ink-2" numberOfLines={2}>
                  {context}
                </Text>
              </View>
            ) : null}
          </View>
          {play.originUri ? (
            <Pressable
              onPress={() => Linking.openURL(play.originUri as string)}
              accessibilityLabel="Open in your music app"
              className="h-9 w-9 items-center justify-center self-start rounded-full bg-fill"
            >
              <Icon icon={ArrowUpRight} size={17} className="text-ink" />
            </Pressable>
          ) : null}
        </View>

        <View className="flex-row items-center">
          <View className="flex-1">
            <ReactionBar subject={{ uri: post.uri, cid: post.cid }} reactions={post.reactions ?? []} />
          </View>
          <Link href={`${href}#replies` as never} asChild>
            <Pressable
              accessibilityLabel={`${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}`}
              className="h-9 flex-row items-center gap-1.5 px-2">
              <Icon icon={MessageCircle} size={20} className="text-ink-2" />
              <Text className="text-sm tabular-nums text-ink-2">{post.replyCount || ""}</Text>
            </Pressable>
          </Link>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copied ? "Link copied" : "Share"}
            onPress={share}
            className="h-9 min-w-9 flex-row items-center justify-center gap-1 px-1"
          >
            <Icon icon={ShareIcon} size={20} className="text-ink-2" />
            {copied ? <Text className="text-sm text-ink-2">Copied</Text> : null}
          </Pressable>
        </View>
      </Glass>
    </AmbientSource>
  );
}
