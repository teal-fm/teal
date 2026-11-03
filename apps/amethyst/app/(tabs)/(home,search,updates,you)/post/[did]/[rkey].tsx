import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import RightRail from "@/components/teal/RightRail";
import SocialPostCard from "@/components/teal/SocialPostCard";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  getSocialPost,
  getSocialPostReplies,
  type SocialPostView,
} from "@/lib/teal/api";
import { useStore } from "@/stores/mainStore";

function postUri(did?: string, rkey?: string) {
  if (!did || !rkey) return undefined;
  return `at://${did}/fm.teal.feed.social.post/${rkey}`;
}

export default function PostDetail() {
  const params = useLocalSearchParams();
  const did = Array.isArray(params.did) ? params.did[0] : params.did;
  const rkey = Array.isArray(params.rkey) ? params.rkey[0] : params.rkey;
  const viewerDid = useStore((state) => state.pdsAgent?.did);
  const routeUri = postUri(did, rkey);
  const routeIdentity = `${routeUri || ""}:${viewerDid || ""}`;
  const activeRoute = useRef(routeIdentity);
  activeRoute.current = routeIdentity;
  const [post, setPost] = useState<SocialPostView | null>(null);
  const [replies, setReplies] = useState<SocialPostView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(0);
  const [deleted, setDeleted] = useState<string | null>(null);
  const [replyPending, setReplyPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    const uri = postUri(did, rkey);
    setPost(null);
    setReplies([]);
    setDeleted(null);
    setReplyPending(false);
    setError(null);
    async function load() {
      if (!uri) {
        setError("This post link is incomplete.");
        return;
      }
      try {
        setError(null);
        const [postRes, repliesRes] = await Promise.all([
          getSocialPost(uri, viewerDid),
          getSocialPostReplies(uri, 30, undefined, viewerDid),
        ]);
        if (!mounted) return;
        setPost(postRes.post);
        setReplies(repliesRes.items);
      } catch (e) {
        if (mounted) {
          setError(
            "We could not load this post. Check your connection and try again.",
          );
          setPost(null);
          setReplies([]);
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [did, rkey, viewerDid, request]);

  return (
    <TealShell rightRail={<RightRail />} pageTitle="Post">
      <Stack.Screen
        options={{ title: post?.text || "Post", headerShown: false }}
      />
      {deleted && deleted === routeUri && (
        <View role="status" className="gap-4 rounded-lg bg-card p-6">
          <Text role="heading" className="text-2xl font-semibold">
            Post deleted
          </Text>
          <Link href="/" asChild>
            <Button>
              <Text>Back to Home</Text>
            </Button>
          </Link>
        </View>
      )}
      {(!post || post.uri !== routeUri) && !error && deleted !== routeUri && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">{error}</Text>
          <Button
            variant="outline"
            className="mt-4"
            onPress={() => setRequest((value) => value + 1)}
          >
            <Text>Try again</Text>
          </Button>
        </View>
      )}
      {post && post.uri === routeUri && (
        <>
          <SectionHeading eyebrow="Post" title="Teal post" level={1} />
          <View className="mb-8">
            <SocialPostCard
              key={post.uri}
              post={post}
              onDeleted={() => {
                if (activeRoute.current !== routeIdentity) return;
                setDeleted(post.uri);
                setPost(null);
              }}
              onReplied={(reply) => {
                if (activeRoute.current !== routeIdentity) return;
                setPost((current) =>
                  current
                    ? { ...current, replyCount: current.replyCount + 1 }
                    : current,
                );
                setReplies((current) => [
                  reply,
                  ...current.filter((item) => item.uri !== reply.uri),
                ]);
                setReplyPending(true);
              }}
            />
          </View>
          <SectionHeading eyebrow="Conversation" title="Replies" />
          {replyPending && (
            <Text role="status" className="mb-4 text-sm text-muted-foreground">
              Reply saved. It may take a moment to appear for other listeners.
            </Text>
          )}
          {replies.length === 0 ? (
            <View className="rounded-lg border border-border bg-card/80 p-6">
              <Text className="text-muted-foreground">
                No replies yet. Start the conversation.
              </Text>
            </View>
          ) : (
            replies.map((reply) => (
              <View key={reply.uri} className="mb-4">
                <SocialPostCard
                  post={reply}
                  onDeleted={(uri) => {
                    if (activeRoute.current !== routeIdentity) return;
                    if (reply.replyParentUri === post.uri) {
                      setPost((current) =>
                        current
                          ? {
                              ...current,
                              replyCount: Math.max(0, current.replyCount - 1),
                            }
                          : current,
                      );
                    }
                    setReplies((current) =>
                      current.filter((item) => item.uri !== uri),
                    );
                  }}
                  onReplied={(newReply) => {
                    if (activeRoute.current !== routeIdentity) return;
                    setReplies((current) => [...current, newReply]);
                    setReplyPending(true);
                  }}
                />
              </View>
            ))
          )}
        </>
      )}
    </TealShell>
  );
}
