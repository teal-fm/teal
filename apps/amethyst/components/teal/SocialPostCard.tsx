import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { displayArtists, type SocialPostView } from "@/lib/teal/api";
import { musicHref } from "@/components/teal/PlayFeedCard";
import RichText from "@/components/teal/RichText";
import SocialComposer from "@/components/teal/SocialComposer";
import { trackViewToPlayView } from "@/lib/teal/social";
import { timeAgo } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import { Heart, MessageCircle, Music2, Repeat2 } from "lucide-react-native";

type ActionState = {
  uri?: string;
  rkey?: string;
  active: boolean;
  busy: boolean;
};

function rkeyFromUri(uri: string) {
  return uri.split("/").pop();
}

export default function SocialPostCard({ post }: { post: SocialPostView }) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const status = useStore((state) => state.status);
  const play = useMemo(() => trackViewToPlayView(post.track), [post.track]);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [repostCount, setRepostCount] = useState(post.repostCount);
  const [replyCount, setReplyCount] = useState(post.replyCount);
  const [replyOpen, setReplyOpen] = useState(false);
  const [like, setLike] = useState<ActionState>({ active: false, busy: false });
  const [repost, setRepost] = useState<ActionState>({
    active: false,
    busy: false,
  });
  const authorLabel =
    post.author?.displayName || post.author?.handle || post.authorDid;
  const authorHref = post.author?.handle || post.authorDid;

  async function toggleAction(kind: "like" | "repost") {
    if (!pdsAgent?.did || status !== "loggedIn") return;
    const current = kind === "like" ? like : repost;
    const setCurrent = kind === "like" ? setLike : setRepost;
    const setCount = kind === "like" ? setLikeCount : setRepostCount;
    if (current.busy) return;

    setCurrent({ ...current, busy: true });
    try {
      if (current.active && current.rkey) {
        await pdsAgent.call(
          "com.atproto.repo.deleteRecord",
          {},
          {
            repo: pdsAgent.did,
            collection: `fm.teal.alpha.feed.social.${kind}`,
            rkey: current.rkey,
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
        rkey: uri ? rkeyFromUri(uri) : undefined,
      });
    } catch (error) {
      console.error(`Failed to ${kind} social post`, error);
      setCurrent({ ...current, busy: false });
    }
  }

  return (
    <View className="rounded-lg border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Link href={`/profile/${authorHref}` as any} asChild>
            <Pressable>
              <Text className="font-black" numberOfLines={1}>
                {authorLabel}
              </Text>
            </Pressable>
          </Link>
          <Text className="font-mono text-[10px] uppercase text-muted-foreground">
            posted {timeAgo(new Date(post.createdAt))}
          </Text>
        </View>
        <View className="rounded-full bg-accent px-2 py-1">
          <Text className="font-mono text-[10px] uppercase text-primary">
            Social
          </Text>
        </View>
      </View>

      {post.text ? (
        <RichText text={post.text} facets={post.facets} className="mt-4 text-base" />
      ) : null}

      <Link href={musicHref(play) as any} asChild>
        <Pressable className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-background">
              <Icon icon={Music2} size={18} className="text-primary" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-black" numberOfLines={1}>
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
