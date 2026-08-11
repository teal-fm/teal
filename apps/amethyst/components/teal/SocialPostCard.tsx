import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  displayArtists,
  getRecordingCoverArtUrl,
  type SocialPostView,
} from "@/lib/teal/api";
import {
  actorAvatarUrl,
  actorProfileHref,
  displayActorName,
  getCachedBlueskyProfile,
  normalizeHandle,
  type DisplayActor,
} from "@/lib/teal/actors";
import RichText from "@/components/teal/RichText";
import SocialComposer from "@/components/teal/SocialComposer";
import {
  musicTrackHref,
  postHrefFromUri,
  rkeyFromAtUri,
} from "@/lib/teal/routes";
import { trackViewToPlayView } from "@/lib/teal/social";
import { timeAgo } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import { Disc3, Heart, MessageCircle, Repeat2 } from "lucide-react-native";

type ActionState = {
  uri?: string;
  rkey?: string;
  active: boolean;
  busy: boolean;
};

function actionStateFromUri(uri?: string): ActionState {
  return {
    active: Boolean(uri),
    busy: false,
    rkey: rkeyFromAtUri(uri),
    uri,
  };
}

export default function SocialPostCard({ post }: { post: SocialPostView }) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const status = useStore((state) => state.status);
  const play = useMemo(() => trackViewToPlayView(post.track), [post.track]);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [repostCount, setRepostCount] = useState(post.repostCount);
  const [replyCount, setReplyCount] = useState(post.replyCount);
  const [replyOpen, setReplyOpen] = useState(false);
  const [blueskyAuthor, setBlueskyAuthor] = useState<DisplayActor>();
  const [like, setLike] = useState<ActionState>(() =>
    actionStateFromUri(post.viewerLike),
  );
  const [repost, setRepost] = useState<ActionState>(() =>
    actionStateFromUri(post.viewerRepost),
  );
  const [releaseArtFailed, setReleaseArtFailed] = useState(false);
  const [recordingArt, setRecordingArt] = useState<string>();
  const indexedAuthor = post.author as DisplayActor | undefined;
  const authorProfile = indexedAuthor
    ? {
        ...blueskyAuthor,
        ...indexedAuthor,
        avatar: indexedAuthor.avatar || blueskyAuthor?.avatar,
        displayName: indexedAuthor.displayName || blueskyAuthor?.displayName,
        handle: indexedAuthor.handle || blueskyAuthor?.handle,
      }
    : blueskyAuthor;
  const authorDid = authorProfile?.did || post.authorDid;
  const authorHandle = normalizeHandle(authorProfile?.handle);
  const authorLabel = displayActorName(authorProfile, authorDid);
  const authorHref = actorProfileHref(authorProfile, authorDid);
  const authorAvatar = actorAvatarUrl(authorProfile, authorDid);
  const releaseArt = coverArtUrl(play.releaseMbId);
  const art = !releaseArtFailed && releaseArt ? releaseArt : recordingArt;
  const postHref = postHrefFromUri(post.uri);
  const trackHref = musicTrackHref(
    displayArtists(play),
    play.releaseName,
    play.trackName,
    undefined,
    post.uri,
  );

  useEffect(() => {
    setLikeCount(post.likeCount);
    setRepostCount(post.repostCount);
    setReplyCount(post.replyCount);
    setLike(actionStateFromUri(post.viewerLike));
    setRepost(actionStateFromUri(post.viewerRepost));
  }, [
    post.likeCount,
    post.replyCount,
    post.repostCount,
    post.uri,
    post.viewerLike,
    post.viewerRepost,
  ]);

  useEffect(() => {
    let mounted = true;
    const needsBlueskyFallback =
      !indexedAuthor?.displayName || !indexedAuthor?.handle;
    if (!authorDid || !needsBlueskyFallback) {
      setBlueskyAuthor(undefined);
      return;
    }
    getCachedBlueskyProfile(authorDid).then((profile) => {
      if (mounted) setBlueskyAuthor(profile);
    });
    return () => {
      mounted = false;
    };
  }, [authorDid, indexedAuthor]);

  useEffect(() => {
    let mounted = true;
    setRecordingArt(undefined);
    if (releaseArt && !releaseArtFailed) {
      return;
    }
    if (!play.recordingMbId) {
      return;
    }
    getRecordingCoverArtUrl(play.recordingMbId).then((url) => {
      if (mounted) setRecordingArt(url);
    });
    return () => {
      mounted = false;
    };
  }, [play.recordingMbId, releaseArt, releaseArtFailed]);

  useEffect(() => {
    setReleaseArtFailed(false);
  }, [releaseArt]);

  async function toggleAction(kind: "like" | "repost") {
    if (!pdsAgent?.did || status !== "loggedIn") return;
    const current = kind === "like" ? like : repost;
    const setCurrent = kind === "like" ? setLike : setRepost;
    const setCount = kind === "like" ? setLikeCount : setRepostCount;
    if (current.busy) return;

    setCurrent({ ...current, busy: true });
    try {
      if (current.active && (current.rkey || current.uri)) {
        await pdsAgent.call(
          "com.atproto.repo.deleteRecord",
          {},
          {
            repo: pdsAgent.did,
            collection: `fm.teal.alpha.feed.social.${kind}`,
            rkey: current.rkey || rkeyFromAtUri(current.uri)!,
          },
        );
        setCount((count) => Math.max(0, count - 1));
        setCurrent({ active: false, busy: false });
        return;
      }

      const res = await pdsAgent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: `fm.teal.alpha.feed.social.${kind}`,
          record: {
            $type: `fm.teal.alpha.feed.social.${kind}`,
            subject: { uri: post.uri, cid: post.cid },
            createdAt: new Date().toISOString(),
          },
        },
      );
      const uri = (res.data as { uri?: string }).uri;
      setCount((count) => count + 1);
      setCurrent({
        active: true,
        busy: false,
        uri,
        rkey: rkeyFromAtUri(uri),
      });
    } catch (error) {
      console.error(`Failed to ${kind} social post`, error);
      setCurrent({ ...current, busy: false });
    }
  }

  return (
    <View className="rounded-lg border border-border bg-card/80 p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row gap-3">
          <Link href={`/profile/${authorHref}` as any} asChild>
            <Pressable className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary">
              {authorAvatar ? (
                <Image
                  source={{ uri: authorAvatar }}
                  className="h-full w-full"
                />
              ) : (
                <Text className="text-lg font-black text-primary-foreground">
                  {authorLabel.slice(0, 1).toUpperCase()}
                </Text>
              )}
            </Pressable>
          </Link>
          <View className="min-w-0 flex-1">
            <Link href={`/profile/${authorHref}` as any} asChild>
              <Pressable>
                <Text className="font-semibold" numberOfLines={1}>
                  {authorLabel}
                </Text>
              </Pressable>
            </Link>
            {authorHandle && (
              <Text
                className="max-w-full font-mono text-xs text-muted-foreground"
                numberOfLines={1}
              >
                @{authorHandle}
              </Text>
            )}
            {postHref ? (
              <Link href={postHref as any} asChild>
                <Pressable>
                  <Text className="text-xs font-light text-muted-foreground">
                    posted {timeAgo(new Date(post.createdAt))}
                  </Text>
                </Pressable>
              </Link>
            ) : (
              <Text className="text-xs font-light text-muted-foreground">
                posted {timeAgo(new Date(post.createdAt))}
              </Text>
            )}
          </View>
        </View>
      </View>

      {post.text ? (
        <RichText
          text={post.text}
          facets={post.facets}
          className="mt-4 text-base"
        />
      ) : null}

      <Link href={trackHref as any} asChild>
        <Pressable className="mt-4 rounded-lg border border-border bg-accent/45 p-3">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-accent">
              {art ? (
                <Image
                  source={{ uri: art }}
                  className="h-full w-full"
                  onError={() => {
                    if (art === releaseArt) {
                      setReleaseArtFailed(true);
                    } else {
                      setRecordingArt(undefined);
                    }
                  }}
                />
              ) : (
                <Icon icon={Disc3} size={20} className="text-primary" />
              )}
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-semibold" numberOfLines={1}>
                {play.trackName}
              </Text>
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {displayArtists(play) || "Unknown artist"}
              </Text>
            </View>
          </View>
        </Pressable>
      </Link>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Button
          variant={like.active ? "default" : "outline"}
          size="sm"
          className="flex-row gap-2"
          disabled={status !== "loggedIn" || like.busy}
          onPress={() => toggleAction("like")}
        >
          <Icon icon={Heart} size={15} />
          <Text>{likeCount}</Text>
        </Button>
        <Button
          variant={repost.active ? "default" : "outline"}
          size="sm"
          className="flex-row gap-2"
          disabled={status !== "loggedIn" || repost.busy}
          onPress={() => toggleAction("repost")}
        >
          <Icon icon={Repeat2} size={15} />
          <Text>{repostCount}</Text>
        </Button>
        <View className="flex-row items-center gap-2 rounded-md border border-border px-3 py-2">
          <Icon icon={MessageCircle} size={15} className="text-muted-foreground" />
          <Text className="text-sm text-muted-foreground">{replyCount}</Text>
        </View>
        <Button
          variant="ghost"
          size="sm"
          disabled={status !== "loggedIn"}
          onPress={() => setReplyOpen((open) => !open)}
        >
          <Text>{replyOpen ? "Close reply" : "Reply"}</Text>
        </Button>
      </View>
      {replyOpen && (
        <View className="mt-4">
          <SocialComposer
            compact
            track={play}
            replyTo={post}
            onPublished={() => {
              setReplyCount((count) => count + 1);
              setReplyOpen(false);
            }}
          />
        </View>
      )}
      {status !== "loggedIn" && (
        <Text className="mt-3 text-xs text-muted-foreground">
          Sign in to like or repost Teal social posts.
        </Text>
      )}
    </View>
  );
}
