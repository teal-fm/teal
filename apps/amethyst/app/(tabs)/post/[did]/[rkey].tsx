import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import RightRail from "@/components/teal/RightRail";
import SocialPostCard from "@/components/teal/SocialPostCard";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Text } from "@/components/ui/text";
import {
  getSocialPost,
  getSocialPostReplies,
  type SocialPostView,
} from "@/lib/teal/api";
import { useStore } from "@/stores/mainStore";

function postUri(did?: string, rkey?: string) {
  if (!did || !rkey) return undefined;
  return `at://${did}/fm.teal.alpha.feed.social.post/${rkey}`;
}

export default function PostDetail() {
  const params = useLocalSearchParams();
  const did = Array.isArray(params.did) ? params.did[0] : params.did;
  const rkey = Array.isArray(params.rkey) ? params.rkey[0] : params.rkey;
  const viewerDid = useStore((state) => state.pdsAgent?.did);
  const [post, setPost] = useState<SocialPostView | null>(null);
  const [replies, setReplies] = useState<SocialPostView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const uri = postUri(did, rkey);
    async function load() {
      if (!uri) return;
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
          setError(e instanceof Error ? e.message : String(e));
          setPost(null);
          setReplies([]);
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [did, rkey, viewerDid]);

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{ title: post?.text || "Post", headerShown: false }}
      />
      {!post && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load post: {error}
          </Text>
        </View>
      )}
      {post && (
        <>
          <SectionHeading eyebrow="Post" title="Teal post" />
          <View className="mb-8">
            <SocialPostCard post={post} />
          </View>
          <SectionHeading eyebrow="Conversation" title="Replies" />
          {replies.length === 0 ? (
            <View className="rounded-lg border border-border bg-card/80 p-6">
              <Text className="text-muted-foreground">
                No indexed replies yet.
              </Text>
            </View>
          ) : (
            replies.map((reply) => (
              <View key={reply.uri} className="mb-4">
                <SocialPostCard post={reply} />
              </View>
            ))
          )}
        </>
      )}
    </TealShell>
  );
}
