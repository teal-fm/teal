import { useState } from "react";
import { SmilePlus } from "lucide-react";
import type { ReactionSummary } from "@teal/client/teal/api";
import { useToggleReaction, useViewerDid } from "@teal/client/teal/queries";
import type { ReactionSubject } from "@teal/client/teal/reactions";
import { cn } from "@teal/client/utils";
import { Icon } from "~/ds";

import { ReactionPicker } from "./ReactionPicker";

/** Reaction counts on a post or listen; pressing a pill toggles your reaction. */
export function ReactionBar({ subject, reactions }: { subject: ReactionSubject; reactions: ReactionSummary[] }) {
  const viewer = useViewerDid();
  const toggle = useToggleReaction();
  const [picking, setPicking] = useState(false);
  const react = (emoji: string) => {
    const existing = reactions.find((r) => r.emoji === emoji)?.viewerReaction;
    // While a reaction is still saving there's no record to remove yet, and a second add would duplicate it.
    if (existing === "pending") return;
    toggle.mutate({ subject, emoji, existing });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={!viewer || r.viewerReaction === "pending"}
          onClick={() => react(r.emoji)}
          aria-pressed={!!r.viewerReaction}
          aria-busy={r.viewerReaction === "pending" || undefined}
          aria-label={`${r.emoji} ${r.count}${r.viewerReaction ? ", yours" : ""}`}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-2.5 transition-transform active:scale-95 disabled:cursor-default",
            r.viewerReaction ? "border border-tint/40 bg-tint-soft" : "bg-fill",
          )}
        >
          <span className="text-[15px]">{r.emoji}</span>
          <span className={cn("text-sm font-semibold tabular-nums", r.viewerReaction ? "text-tint" : "text-ink")}>{r.count}</span>
        </button>
      ))}
      {viewer ? (
        <>
          <button
            type="button"
            onClick={() => setPicking(true)}
            aria-label="Add reaction"
            className="flex h-8 w-9 items-center justify-center rounded-full bg-fill hover:brightness-95"
          >
            <Icon icon={SmilePlus} size={18} className="text-ink-2" />
          </button>
          <ReactionPicker visible={picking} onPick={react} onClose={() => setPicking(false)} />
        </>
      ) : null}
    </div>
  );
}
