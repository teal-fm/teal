import { useState } from "react";
import { Pressable, View } from "react-native";
import type { ReactionSummary } from "@teal/client/teal/api";
import { useToggleReaction, useViewerDid } from "@teal/client/teal/queries";
import type { ReactionSubject } from "@teal/client/teal/reactions";
import { cn } from "@teal/client/utils";
import { SmilePlus } from "lucide-react-native";
import { Icon, Text } from "@/components/ds";

import { ReactionPicker } from "./ReactionPicker";

/** Reaction counts on a post or listen; tapping a pill toggles your reaction. */
export function ReactionBar({
  subject,
  reactions,
}: {
  subject: ReactionSubject;
  reactions: ReactionSummary[];
}) {
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
    <View className="flex-row flex-wrap gap-1.5">
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          disabled={!viewer || r.viewerReaction === "pending"}
          onPress={() => react(r.emoji)}
          accessibilityRole="button"
          aria-pressed={!!r.viewerReaction}
          aria-busy={r.viewerReaction === "pending" || undefined}
          accessibilityLabel={`${r.emoji} ${r.count}${r.viewerReaction ? ", yours" : ""}`}
          className={cn(
            "h-8 flex-row items-center gap-1.5 rounded-full px-2.5 active:scale-95",
            r.viewerReaction ? "border border-tint/40 bg-tint-soft" : "bg-fill",
          )}
        >
          <Text className="text-[15px]">{r.emoji}</Text>
          <Text
            className={cn(
              "text-sm font-semibold tabular-nums",
              r.viewerReaction ? "text-tint" : "text-ink",
            )}
          >
            {r.count}
          </Text>
        </Pressable>
      ))}
      {viewer && (
        <>
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel="Add reaction"
            className="h-8 w-9 items-center justify-center rounded-full bg-fill"
          >
            <Icon icon={SmilePlus} size={18} className="text-ink-2" />
          </Pressable>
          <ReactionPicker visible={picking} onPick={react} onClose={() => setPicking(false)} />
        </>
      )}
    </View>
  );
}
