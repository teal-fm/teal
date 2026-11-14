import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { usePdsAgent } from "@teal/client/session";
import type { SocialPostView } from "@teal/client/teal/api";
import { publishPost, type ReplyTarget } from "@teal/client/teal/compose";
import { useViewerDid } from "@teal/client/teal/queries";
import { cn } from "@teal/client/utils";
import { Button, LinkButton } from "~/ds";
import { useAuth } from "~/lib/auth";

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
  const agent = usePdsAgent();
  const viewer = useViewerDid();
  const profiles = useAuth((state) => state.profile);
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
      <div className="flex flex-col items-start gap-2">
        <p className="font-semibold">Sign in to {replyTo ? "reply" : "post"} about what you hear.</p>
        <LinkButton href="/auth/login" label="Sign in" size="sm" />
      </div>
    );
  }

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!agent || !selected || !text.trim() || busy || remaining < 0) return;
    setBusy(true);
    setError(null);
    try {
      const post = await publishPost(agent, {
        text,
        track: selected,
        replyTo,
        // Shown until the index has the post: teal's details first, then Bluesky's.
        author: {
          did: viewer,
          displayName: profiles?.teal?.displayName || profiles?.bsky?.displayName,
          handle: profiles?.bsky?.handle,
          avatar: profiles?.teal?.avatar || profiles?.bsky?.avatar,
        } as SocialPostView["author"],
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
    <div className="flex flex-col gap-3">
      {chooseTrack && !replyTo ? <TrackPicker autoSelect selected={selected} onSelect={setSelected} /> : null}
      <form onSubmit={publish} className="flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // ⌘/Ctrl+Enter posts, as in most composers.
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
          }}
          maxLength={MAX_LENGTH}
          aria-label={replyTo ? "Your reply" : "What do you think of it?"}
          placeholder={replyTo ? "Write a reply" : "What do you think of it?"}
          className={cn(
            "resize-y rounded-[14px] border border-hair bg-fill px-3.5 py-3 text-[17px] text-ink outline-none",
            replyTo ? "min-h-20" : "min-h-28",
          )}
        />
        {error ? (
          <p role="alert" className="text-[14px] text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p aria-live="polite" className={cn("text-[13px] tabular-nums", remaining < 0 ? "text-destructive" : "text-ink-2")}>
            {remaining < 60 ? (remaining < 0 ? `${-remaining} over` : `${remaining} left`) : ""}
          </p>
          <Button
            type="submit"
            label={busy ? "Posting" : replyTo ? "Reply" : "Post"}
            loading={busy}
            disabled={!selected || !text.trim() || remaining < 0}
          />
        </div>
      </form>
    </div>
  );
}
