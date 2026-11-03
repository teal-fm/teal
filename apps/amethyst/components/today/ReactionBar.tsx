import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import type { ReactionSummary } from "@/lib/teal/api";
import { useToggleReaction, useViewerDid } from "@/lib/teal/queries";
import type { ReactionSubject } from "@/lib/teal/reactions";
import { cn } from "@/lib/utils";
import { SmilePlus } from "lucide-react-native";

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
    toggle.mutate({ subject, emoji, existing: existing === "pending" ? undefined : existing });
  };

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          disabled={!viewer}
          onPress={() => react(r.emoji)}
          accessibilityLabel={`${r.emoji} ${r.count}${r.viewerReaction ? ", yours" : ""}`}
          accessibilityState={{ selected: !!r.viewerReaction }}
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
