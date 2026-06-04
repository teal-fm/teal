import { useMemo, useState } from "react";
import { View } from "react-native";
import { RichText as AtprotoRichText } from "@atproto/api";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { playViewToTrackView } from "@/lib/teal/social";
import { useStore } from "@/stores/mainStore";

import type { SocialPostView } from "@/lib/teal/api";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

type SocialComposerProps = {
  track: PlayView;
  onPublished: (post: SocialPostView) => void;
};

function extractTags(text: string) {
  return Array.from(text.matchAll(/(^|\s)#([\p{L}\p{N}_-]{1,64})/gu))
    .map((match) => match[2])
    .slice(0, 8);
}

function currentLangs() {
  if (typeof navigator === "undefined") return undefined;
  const language = navigator.language?.split("-")[0];
  return language ? [language].slice(0, 3) : undefined;
}

export default function SocialComposer({
  track,
  onPublished,
}: SocialComposerProps) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const status = useStore((state) => state.status);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tags = useMemo(() => extractTags(text), [text]);

  async function submit() {
    if (!pdsAgent?.did || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const rt = new AtprotoRichText({ text });
      await rt.detectFacets(pdsAgent);
      const record = {
        $type: "fm.teal.alpha.feed.social.post",
        text,
        track: playViewToTrackView(track),
        facets: rt.facets,
        tags,
        langs: currentLangs(),
        createdAt: new Date().toISOString(),
      };
      const res = await pdsAgent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: "fm.teal.alpha.feed.social.post",
          record,
        },
      );
      const uri = (res.data as { uri?: string }).uri || "";
      const cid = (res.data as { cid?: string }).cid || "";
      onPublished({
        uri,
        cid,
        authorDid: pdsAgent.did,
        text,
        track: record.track,
        facets: rt.facets,
        tags,
        langs: record.langs,
        createdAt: record.createdAt,
        likeCount: 0,
        repostCount: 0,
        replyCount: 0,
      });
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (status !== "loggedIn") {
    return (
      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-bold">Sign in to post about what you hear.</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Teal social posts attach a track and travel with your ATProto repo.
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-lg border border-border bg-card p-4">
      <Text className="font-mono text-[10px] uppercase text-primary">
        Compose social post
      </Text>
      <Text className="mt-1 font-bold" numberOfLines={1}>
        Attached: {track.trackName}
      </Text>
      <Textarea
        className="mt-3 min-h-24"
        placeholder="Say something about this track..."
        value={text}
        onChangeText={setText}
      />
      {tags.length > 0 && (
        <Text className="mt-2 font-mono text-[10px] uppercase text-muted-foreground">
          Tags: {tags.join(", ")}
        </Text>
      )}
      {error && <Text className="mt-2 text-sm text-destructive">{error}</Text>}
      <Button
        className="mt-3 self-start"
        disabled={submitting || text.length > 3000}
        onPress={submit}
      >
        <Text>{submitting ? "Publishing..." : "Publish post"}</Text>
      </Button>
    </View>
  );
}
