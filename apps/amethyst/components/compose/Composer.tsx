import { useEffect, useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { Link } from "expo-router";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type { SocialPostView } from "@/lib/teal/api";
import { publishPost, type ReplyTarget } from "@/lib/teal/compose";
import { useViewerDid } from "@/lib/teal/queries";
import { cn } from "@/lib/utils";
import { Button, Text } from "@/components/ds";
import { useStore } from "@/stores/mainStore";

import { TrackPicker } from "./TrackPicker";

// The lexicon allows 300 graphemes (and 3000 bytes); code points are a close stand-in.
const MAX_GRAPHEMES = 300;
const MAX_LENGTH = 3000;

/**
 * Write a song post, or a reply. Replies carry their parent's song; new posts let
 * you choose one when `chooseTrack` is set.
 */
export function Composer({
  track,
  chooseTrack,
  replyTo,
  onPublished,
}: {
  track?: PlayView | null;
  chooseTrack?: boolean;
  replyTo?: ReplyTarget;
  onPublished: (post: SocialPostView) => void;
}) {
  const agent = useStore((state) => state.pdsAgent);
  const viewer = useViewerDid();
  const author = useStore((state) => (viewer ? state.profiles[viewer]?.teal : undefined));
  const [selected, setSelected] = useState<PlayView | null>(track ?? null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = useMemo(() => MAX_GRAPHEMES - Array.from(text).length, [text]);

  useEffect(() => {
    if (track) setSelected(track);
  }, [track]);

  if (!viewer) {
    return (
      <View className="gap-2">
        <Text className="font-semibold">Sign in to {replyTo ? "reply" : "post"} about what you hear.</Text>
        <Link href="/auth/login" asChild>
          <Button label="Sign in" size="sm" />
        </Link>
      </View>
    );
  }

  const publish = async () => {
    if (!agent || !selected || !text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const post = await publishPost(agent, {
        text,
        track: selected,
        replyTo,
        author: author ? { did: viewer, displayName: author.displayName, avatar: author.avatar } : undefined,
      });
      setText("");
      onPublished(post);
    } catch {
      setError(replyTo ? "Your reply didn't post. Try again." : "Your post didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3">
      {chooseTrack && !replyTo ? <TrackPicker autoSelect selected={selected} onSelect={setSelected} /> : null}
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={MAX_LENGTH}
        accessibilityLabel={replyTo ? "Your reply" : "What do you think of it?"}
        placeholder={replyTo ? "Write a reply" : "What do you think of it?"}
        placeholderTextColor="rgba(120,120,128,0.9)"
        textAlignVertical="top"
        className={cn("rounded-[14px] border border-hair bg-fill px-3.5 py-3 font-sans text-[17px] text-ink", replyTo ? "min-h-20" : "min-h-28")}
      />
      {error ? (
        <Text role="alert" className="text-[14px] text-destructive">
          {error}
        </Text>
      ) : null}
      <View className="flex-row items-center justify-between gap-3">
        <Text aria-live="polite" className={cn("text-[13px] tabular-nums", remaining < 0 ? "text-destructive" : "text-ink-2")}>
          {remaining < 60 ? (remaining < 0 ? `${-remaining} over` : `${remaining} left`) : ""}
        </Text>
        <Button
          label={busy ? "Posting" : replyTo ? "Reply" : "Post"}
          loading={busy}
          disabled={!selected || !text.trim() || remaining < 0}
          onPress={publish}
        />
      </View>
    </View>
  );
}
