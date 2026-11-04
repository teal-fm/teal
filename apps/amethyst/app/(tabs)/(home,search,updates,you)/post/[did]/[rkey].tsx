import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AmbientScreen,
  AmbientSource,
  Avatar,
  Cover,
  coverUri,
  Glass,
  useAmbientScroll,
  useHalo,
} from "@/components/ds";
import { ReactionBar } from "@/components/today/ReactionBar";
import RichText from "@/components/teal/RichText";
import SocialComposer from "@/components/teal/SocialComposer";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  getSocialPost,
  getSocialPostReplies,
  type SocialPostView,
} from "@/lib/teal/api";
import { useViewerDid } from "@/lib/teal/queries";
import { absoluteUrl, musicArtistHref, postHrefFromUri, postUriFromRoute } from "@/lib/teal/routes";
import { shareLink } from "@/lib/teal/share";
import { socialPostDeleteParams, trackViewToPlayView } from "@/lib/teal/social";
import { shortAgo } from "@/lib/teal/today";
import { useStore } from "@/stores/mainStore";
import { ArrowUpRight, ChevronLeft, MessageCircle, Share as ShareIcon, Trash2 } from "lucide-react-native";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Reply({ reply }: { reply: SocialPostView }) {
  const name = reply.author?.displayName || reply.author?.handle || "Someone";
  return (
    <View className="flex-row gap-3 border-b border-hair py-3.5 last:border-b-0">
      <Link href={`/profile/${reply.authorDid}`} asChild>
        <Pressable>
          <Avatar did={reply.authorDid} avatar={reply.author?.avatar} name={name} size={36} />
        </Pressable>
      </Link>
      <View className="min-w-0 flex-1 gap-1.5">
        <Text className="text-[15px] text-ink-2">
          <Text className="font-semibold text-ink">{name}</Text> · {shortAgo(reply.createdAt)}
        </Text>
        <RichText text={reply.text} facets={reply.facets} className="text-[16px] leading-[22px] text-ink" />
        <ReactionBar subject={{ uri: reply.uri, cid: reply.cid }} reactions={reply.reactions ?? []} />
      </View>
    </View>
  );
}

/** A song post: the song as the hero, then what was said, who reacted, and the conversation. */
export default function PostDetail() {
  return (
    <AmbientScreen>
      <PostBody />
    </AmbientScreen>
  );
}

function PostBody() {
  const params = useLocalSearchParams();
  const uri = postUriFromRoute(param(params.did), param(params.rkey), param(params.alpha));
  const viewer = useViewerDid();
  const agent = useStore((state) => state.pdsAgent);
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const halo = useHalo();
  const ambientScroll = useAmbientScroll();
  const wide = width >= 1000;
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const post = useQuery({
    queryKey: ["post", uri, viewer],
    queryFn: () => getSocialPost(uri!, viewer).then((r) => r.post),
    enabled: !!uri,
  });
  const replies = useQuery({
    queryKey: ["replies", uri, viewer],
    queryFn: () => getSocialPostReplies(uri!, 50, undefined, viewer).then((r) => r.items),
    enabled: !!uri,
  });

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const data = post.data;
  const play = data ? trackViewToPlayView(data.track) : undefined;
  const artist = play?.artists?.[0];
  const author = data?.author;
  const name = author?.displayName || author?.handle || "Someone";
  const isOwn = !!viewer && data?.authorDid === viewer;
  const context = data?.listenContext;

  async function deletePost() {
    if (!agent?.did || !data) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await agent.call(
        "com.atproto.repo.deleteRecord",
        {},
        socialPostDeleteParams(data.uri, agent.did, data.cid),
      );
      void client.invalidateQueries({ queryKey: ["feed"] });
      back();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't delete this post.");
      setDeleting(false);
    }
  }

  const hero = data && play && (
    <View className="gap-4" style={wide ? { width: 440, flexShrink: 0 } : { paddingHorizontal: 20 }}>
      <AmbientSource uri={coverUri(play.releaseMbId)}>
        <Cover
          releaseMbId={play.releaseMbId}
          radius={18}
          className="w-full shadow-2xl"
          accessibilityLabel={`${play.releaseName ?? play.trackName} cover`}
        />
      </AmbientSource>
      <View className="gap-1">
        <Text style={halo} role="heading" aria-level={1} className="text-[26px] font-bold leading-[30px] text-ink">
          {play.trackName}
        </Text>
        <Text style={halo} className="text-[17px] text-ink-2">
          {artist ? (
            <Link href={musicArtistHref(artist.artistName, artist.artistMbId) as never} className="font-semibold text-ink">
              {artist.artistName}
            </Link>
          ) : null}
          {play.releaseName ? ` · ${play.releaseName}` : ""}
        </Text>
      </View>
      {play.originUri ? (
        <Pressable
          onPress={() => Linking.openURL(play.originUri as string)}
          className="h-11 flex-row items-center justify-center gap-2 self-start rounded-full bg-tint px-5"
        >
          <Icon icon={ArrowUpRight} size={18} className="text-on-tint" />
          <Text className="font-semibold text-on-tint">Listen</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ScrollView
      onScroll={ambientScroll}
      scrollEventThrottle={50}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 60 }}
    >
      <Stack.Screen options={{ title: data?.text || "Post" }} />
      <View className="mx-auto w-full max-w-[1000px]">
        <Pressable onPress={back} accessibilityRole="button" className="mb-3 ml-4 self-start">
          <Glass className="h-10 flex-row items-center gap-0.5 rounded-full pl-2 pr-4">
            <Icon icon={ChevronLeft} size={22} className="text-ink" />
            <Text className="text-[16px] font-semibold text-ink">Back</Text>
          </Glass>
        </Pressable>

        {post.isLoading ? (
          <ActivityIndicator className="my-24" />
        ) : post.isError || !data ? (
          <Glass className="mx-4 gap-2 p-5">
            <Text className="text-[17px] font-semibold text-ink">This post didn't load</Text>
            <Text className="text-[15px] text-ink-2">It may have been deleted, or teal couldn't be reached.</Text>
            <Pressable onPress={() => post.refetch()} className="mt-2 self-start rounded-full bg-fill px-4 py-2">
              <Text className="font-semibold text-ink">Try again</Text>
            </Pressable>
          </Glass>
        ) : (
          <View className={wide ? "flex-row items-start gap-8 px-5" : "gap-5"}>
            {hero}
            <View className={wide ? "min-w-0 flex-1 gap-3.5" : "gap-3.5 px-2.5"}>
              <Glass className="gap-3.5 p-4">
                <View className="flex-row items-center gap-3">
                  <Link href={`/profile/${data.authorDid}`} asChild>
                    <Pressable className="flex-row items-center gap-3">
                      <Avatar did={data.authorDid} avatar={author?.avatar} name={name} size={44} />
                      <View>
                        <Text className="text-[16px] font-semibold text-ink">{name}</Text>
                        {author?.handle ? <Text className="text-sm text-ink-2">@{author.handle}</Text> : null}
                      </View>
                    </Pressable>
                  </Link>
                </View>
                {data.text ? (
                  <RichText text={data.text} facets={data.facets} className="text-[21px] leading-[28px] text-ink" />
                ) : null}
                <Text className="text-sm text-ink-2">
                  {new Date(data.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  {context?.authorPlayCount && context.authorPlayCount > 1
                    ? ` · ${name} has played this ${context.authorPlayCount} times`
                    : ""}
                </Text>
                {viewer || (data.reactions ?? []).length > 0 ? (
                  <View className="border-t border-hair pt-3.5">
                    <ReactionBar subject={{ uri: data.uri, cid: data.cid }} reactions={data.reactions ?? []} />
                  </View>
                ) : null}
                <View className="flex-row items-center border-t border-hair pt-2">
                  <View
                    accessible
                    accessibilityLabel={`${data.replyCount} ${data.replyCount === 1 ? "reply" : "replies"}`}
                    className="h-10 flex-1 flex-row items-center justify-center gap-1.5"
                  >
                    <Icon icon={MessageCircle} size={20} className="text-ink-2" />
                    <Text className="text-sm tabular-nums text-ink-2">{data.replyCount}</Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      const result = await shareLink(
                        `${data.text ? `${data.text} ` : ""}${play?.trackName ?? ""}`,
                        absoluteUrl(postHrefFromUri(data.uri) ?? "/"),
                      );
                      setShareNote(result === "copied" ? "Link copied." : result === "failed" ? "Couldn't share this post." : null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Share"
                    className="h-10 flex-1 items-center justify-center"
                  >
                    <Icon icon={ShareIcon} size={20} className="text-ink-2" />
                  </Pressable>
                  {isOwn ? (
                    <Pressable
                      onPress={deletePost}
                      disabled={deleting}
                      accessibilityLabel="Delete post"
                      className="h-10 flex-1 items-center justify-center"
                    >
                      <Icon icon={Trash2} size={20} className="text-destructive" />
                    </Pressable>
                  ) : null}
                </View>
                {deleteError ? <Text className="text-sm text-destructive">{deleteError}</Text> : null}
                {shareNote ? (
                  <Text role="status" className="text-sm text-ink-2">
                    {shareNote}
                  </Text>
                ) : null}
              </Glass>

              {context && context.circleListenerCount > 0 ? (
                <Glass className="gap-2 p-4">
                  <Text role="heading" aria-level={2} className="text-[20px] font-bold text-ink">
                    In your circle
                  </Text>
                  <Text className="text-[15px] text-ink-2">
                    {context.circleListenerCount} {context.circleListenerCount === 1 ? "person you follow has" : "people you follow have"} played this today.
                  </Text>
                  {context.circleSample.map((p) => (
                    <Link key={p.did} href={`/profile/${p.did}`} asChild>
                      <Pressable className="flex-row items-center gap-3 py-1.5">
                        <Avatar did={p.did} avatar={p.avatar} name={p.displayName ?? p.handle} size={40} />
                        <Text className="text-[16px] font-semibold text-ink">{p.displayName || p.handle}</Text>
                      </Pressable>
                    </Link>
                  ))}
                </Glass>
              ) : null}

              <Glass className="p-4" nativeID="replies">
                <Text role="heading" aria-level={2} className="mb-1 text-[20px] font-bold text-ink">
                  Replies
                </Text>
                {replies.isLoading ? (
                  <ActivityIndicator className="my-4" />
                ) : replies.isError ? (
                  <View className="gap-2 py-2">
                    <Text className="text-[15px] text-ink-2">Replies didn't load.</Text>
                    <Pressable onPress={() => replies.refetch()} className="self-start rounded-full bg-fill px-4 py-2">
                      <Text className="font-semibold text-ink">Try again</Text>
                    </Pressable>
                  </View>
                ) : (replies.data ?? []).length === 0 ? (
                  <Text className="py-2 text-[15px] text-ink-2">No replies yet. Start the conversation.</Text>
                ) : (
                  replies.data!.map((reply) => <Reply key={reply.uri} reply={reply} />)
                )}
                {viewer ? (
                  <View className="mt-3 border-t border-hair pt-3">
                    <SocialComposer
                      compact
                      replyTo={data}
                      onPublished={() => {
                        void client.invalidateQueries({ queryKey: ["replies", uri] });
                        void client.invalidateQueries({ queryKey: ["post", uri] });
                      }}
                    />
                  </View>
                ) : null}
              </Glass>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
