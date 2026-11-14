import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, MessageCircle, Share as ShareIcon, Trash2 } from "lucide-react-native";
import { getSocialPost, getSocialPostReplies, type SocialPostView } from "@teal/client/teal/api";
import { forgetPost, rememberPost, useViewerDid } from "@teal/client/teal/queries";
import { absoluteUrl, musicArtistHref, postHrefFromUri, postUriFromRoute } from "@teal/client/teal/routes";
import { shareLink } from "@/lib/teal/share";
import { socialPostDeleteParams, trackViewToPlayView } from "@teal/client/teal/social";
import { shortAgo } from "@teal/client/teal/today";
import { Composer } from "@/components/compose/Composer";
import {
  AmbientSource,
  Avatar,
  Button,
  ButtonRow,
  Cover,
  coverUri,
  ErrorNotice,
  Glass,
  goBack,
  Heading,
  Icon,
  IconButton,
  Loading,
  Screen,
  Text,
  useLayout,
} from "@/components/ds";
import RichText from "@/components/post/RichText";
import { ReactionBar } from "@/components/today/ReactionBar";
import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";
import { displayActorName } from "@teal/client/teal/actors";
import { useStore } from "@/stores/mainStore";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Reply({ reply, last }: { reply: SocialPostView; last: boolean }) {
  const author = useDisplayActor(reply.author, reply.authorDid);
  const name = author.name;
  return (
    <View className={last ? "flex-row gap-3 py-3.5" : "flex-row gap-3 border-b border-hair py-3.5"}>
      <Link href={author.href as never} asChild>
        <Pressable accessibilityLabel={name ? `${name}'s profile` : "Profile"} className="self-start">
          <Avatar did={author.did} avatar={author.avatar} name={name} size={36} />
        </Pressable>
      </Link>
      <View className="min-w-0 flex-1 gap-1.5">
        <Text className="text-[15px] text-ink-2">
          <Text className="font-semibold">{name}</Text> · {shortAgo(reply.createdAt)}
        </Text>
        <RichText text={reply.text} facets={reply.facets} className="text-[16px] leading-[22px] text-ink" />
        <ReactionBar subject={{ uri: reply.uri, cid: reply.cid }} reactions={reply.reactions ?? []} />
      </View>
    </View>
  );
}

/** A song post: the song as the hero, then what was said, who reacted, and the conversation. */
export default function PostScreen() {
  const params = useLocalSearchParams();
  const uri = postUriFromRoute(param(params.did), param(params.rkey), param(params.alpha));
  const viewer = useViewerDid();
  const agent = useStore((state) => state.pdsAgent);
  const client = useQueryClient();
  const layout = useLayout();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmRef = useRef<View>(null);
  const trashRef = useRef<View>(null);
  const armed = useRef(false);
  // Keyboard focus follows the trash button into the confirmation, and back again on Cancel.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (confirmDelete) (confirmRef.current as unknown as HTMLElement | null)?.focus();
    else if (armed.current) (trashRef.current as unknown as HTMLElement | null)?.focus();
    armed.current = confirmDelete;
  }, [confirmDelete]);
  const [note, setNote] = useState<string | null>(null);

  const post = useQuery({
    queryKey: ["post", uri, viewer ?? null],
    queryFn: () => getSocialPost(uri!, viewer).then((r) => r.post),
    enabled: !!uri,
  });
  const replies = useQuery({
    queryKey: ["replies", uri, viewer ?? null],
    queryFn: () => getSocialPostReplies(uri!, 50, undefined, viewer).then((r) => r.items),
    enabled: !!uri,
  });

  // A reply-count link lands on #replies; bring the replies into view once they've loaded.
  // The replies panel only mounts once the post has loaded too, so wait for both.
  const ready = !post.isLoading && !replies.isLoading;
  useEffect(() => {
    if (Platform.OS !== "web" || !ready || window.location.hash !== "#replies") return;
    requestAnimationFrame(() => document.getElementById("replies")?.scrollIntoView({ block: "start" }));
  }, [ready]);

  const data = post.data;
  const play = data ? trackViewToPlayView(data.track) : undefined;
  const artist = play?.artists?.[0];
  const name = useDisplayActor(data?.author, data?.authorDid).name;
  const context = data?.listenContext;
  const isOwn = !!viewer && data?.authorDid === viewer;

  const remove = async () => {
    if (!agent?.did || !data || deleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setNote(null);
    try {
      await agent.call("com.atproto.repo.deleteRecord", {}, socialPostDeleteParams(data.uri, agent.did, data.cid));
      forgetPost(client, data.uri, data.replyParentUri);
      goBack();
    } catch {
      setNote("The post wasn't deleted. Try again.");
      setDeleting(false);
    }
  };

  const share = async () => {
    if (!data) return;
    const result = await shareLink(
      `${data.text ? `${data.text} ` : ""}${play?.trackName ?? ""}`,
      absoluteUrl(postHrefFromUri(data.uri) ?? "/"),
    );
    setNote(result === "copied" ? "Link copied." : result === "failed" ? "Couldn't share this post." : null);
  };

  if (post.isLoading) {
    return (
      <Screen back pageTitle="Post">
        <Loading />
      </Screen>
    );
  }
  if (post.isError || !data || !play) {
    return (
      <Screen back pageTitle="Post">
        <ErrorNotice title="This post didn't load" body="It may have been deleted, or teal couldn't be reached." onRetry={() => post.refetch()} />
      </Screen>
    );
  }

  const hero = (
    <View className="gap-4" style={layout.sidebar ? { width: 400, flexShrink: 0 } : undefined}>
      <AmbientSource uri={coverUri(play.releaseMbId)}>
        <Cover releaseMbId={play.releaseMbId} radius={18} className="w-full" accessibilityLabel={`${play.releaseName ?? play.trackName} cover`} />
      </AmbientSource>
      <View className="gap-1">
        <Heading level={1} size="title" onBackdrop className="text-[26px] leading-[30px]">
          {play.trackName}
        </Heading>
        <Text onBackdrop className="text-[17px] text-ink-2">
          {artist ? (
            <Link href={musicArtistHref(artist.artistName, artist.artistMbId) as never} className="font-semibold text-ink">
              {artist.artistName}
            </Link>
          ) : null}
          {play.releaseName ? ` · ${play.releaseName}` : ""}
        </Text>
      </View>
      {play.originUri ? (
        <Button label="Listen" icon={ArrowUpRight} onPress={() => Linking.openURL(play.originUri as string)} />
      ) : null}
    </View>
  );

  return (
    <Screen back pageTitle={data.text || play.trackName} width="wide">
      <View className={layout.sidebar ? "flex-row items-start gap-8" : "gap-5"}>
        {hero}
        <View className="min-w-0 flex-1 gap-3.5">
          <Glass className="gap-3.5 p-4">
            <Link href={`/profile/${data.authorDid}`} asChild>
              <Pressable className="flex-row items-center gap-3 self-start">
                <Avatar did={data.authorDid} avatar={data.author?.avatar} name={name} size={44} />
                <View>
                  <Text className="font-semibold">{name}</Text>
                  {data.author?.handle ? <Text className="text-[14px] text-ink-2">@{data.author.handle}</Text> : null}
                </View>
              </Pressable>
            </Link>
            {data.text ? <RichText text={data.text} facets={data.facets} className="text-[21px] leading-[28px] text-ink" /> : null}
            <Text className="text-[14px] text-ink-2">
              {new Date(data.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              {context?.authorPlayCount && context.authorPlayCount > 1 ? ` · ${name} has played this ${context.authorPlayCount} times` : ""}
            </Text>
            {viewer || (data.reactions ?? []).length > 0 ? (
              <View className="border-t border-hair pt-3.5">
                <ReactionBar subject={{ uri: data.uri, cid: data.cid }} reactions={data.reactions ?? []} />
              </View>
            ) : null}
            <View className="flex-row items-center gap-2 border-t border-hair pt-3">
              <View accessible accessibilityLabel={`${data.replyCount} ${data.replyCount === 1 ? "reply" : "replies"}`} className="flex-1 flex-row items-center gap-1.5">
                <Icon icon={MessageCircle} size={20} className="text-ink-2" />
                <Text className="text-[14px] tabular-nums text-ink-2">{data.replyCount}</Text>
              </View>
              <IconButton icon={ShareIcon} label="Share" size={38} onPress={share} />
              {isOwn && !confirmDelete ? <IconButton ref={trashRef} icon={Trash2} label="Delete post" size={38} onPress={remove} /> : null}
            </View>
            {isOwn && confirmDelete ? (
              <View role="alert" className="gap-2 rounded-[14px] bg-fill p-3">
                <Text className="font-semibold">Delete this post? This can't be undone.</Text>
                <ButtonRow>
                  <Button ref={confirmRef} label={deleting ? "Deleting" : "Delete"} size="sm" variant="destructive" loading={deleting} onPress={remove} />
                  <Button label="Cancel" size="sm" variant="secondary" disabled={deleting} onPress={() => setConfirmDelete(false)} />
                </ButtonRow>
              </View>
            ) : null}
            {note ? (
              <Text role="status" className="text-[14px] text-ink-2">
                {note}
              </Text>
            ) : null}
          </Glass>

          {context && context.circleListenerCount > 0 ? (
            <Glass className="gap-2 p-4">
              <Heading level={2}>In your circle</Heading>
              <Text className="text-[15px] text-ink-2">
                {context.circleListenerCount} {context.circleListenerCount === 1 ? "person you follow has" : "people you follow have"} played this today.
              </Text>
              {context.circleSample.map((p) => (
                <Link key={p.did} href={`/profile/${p.did}`} asChild>
                  <Pressable className="flex-row items-center gap-3 py-1.5">
                    <Avatar did={p.did} avatar={p.avatar} name={displayActorName(p, p.did)} size={40} />
                    <Text className="font-semibold">{displayActorName(p, p.did)}</Text>
                  </Pressable>
                </Link>
              ))}
            </Glass>
          ) : null}

          <Glass className="p-4" nativeID="replies">
            <Heading level={2} className="mb-1">
              Replies
            </Heading>
            {replies.isLoading ? (
              <Loading className="py-4" />
            ) : replies.isError ? (
              <View className="gap-2 py-2">
                <Text className="text-[15px] text-ink-2">Replies didn't load.</Text>
                <Button label="Try again" variant="secondary" size="sm" onPress={() => replies.refetch()} />
              </View>
            ) : !replies.data?.length ? (
              <Text className="py-2 text-[15px] text-ink-2">No replies yet. Start the conversation.</Text>
            ) : (
              replies.data.map((reply, i) => <Reply key={reply.uri} reply={reply} last={i === replies.data!.length - 1} />)
            )}
            <View className="mt-3 border-t border-hair pt-3">
              <Composer
                track={play}
                replyTo={data}
                onPublished={(reply) => rememberPost(client, reply.authorDid, reply)}
              />
            </View>
          </Glass>
        </View>
      </View>
    </Screen>
  );
}
