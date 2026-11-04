import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, TextInput, View } from "react-native";
import { QUICK_REACTIONS } from "@/lib/teal/reactions";
import { Glass, Text, usePlaceholderColor } from "@/components/ds";

/** A single grapheme-ish emoji: no letters, digits, or spaces. */
function asEmoji(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /[\p{L}\p{N}\s]/u.test(trimmed)) return undefined;
  // Hermes may lack Intl.Segmenter; then accept short input whole (ZWJ emoji are long).
  if (typeof Intl.Segmenter === "undefined") return trimmed.length <= 16 ? trimmed : undefined;
  return [...new Intl.Segmenter().segment(trimmed)][0]?.segment;
}

/** The quick reactions plus any emoji from the keyboard. */
export function ReactionPicker({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  const placeholder = usePlaceholderColor();
  const panel = useRef<View>(null);

  // On the web, focus moves into the picker when it opens and returns when it closes.
  // React Native Web's Modal already closes on Escape. This keys off `visible` alone,
  // so a parent re-render (Today refetches every minute) can't pull focus out mid-typing.
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      (panel.current as unknown as HTMLElement | null)?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      if (previous?.isConnected) previous.focus();
    };
  }, [visible]);
  const pick = (emoji: string) => {
    setCustom("");
    onPick(emoji);
    onClose();
  };
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close reactions"
        className="flex-1 items-center justify-center bg-black/30 px-6"
        onPress={onClose}
      >
        <Pressable onPress={() => undefined}>
          <View ref={panel} role="group" aria-label="Add a reaction">
          <Glass strong className="items-center gap-3 rounded-[28px] p-3">
            <View role="menu" className="flex-row gap-1">
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  role="menuitem"
                  accessibilityLabel={`React ${emoji}`}
                  onPress={() => pick(emoji)}
                  className="h-12 w-12 items-center justify-center rounded-full web:transition-transform web:hover:scale-125"
                >
                  <Text className="text-[28px]">{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <View className="w-full flex-row items-center gap-2 rounded-full bg-fill px-4">
              <TextInput
                value={custom}
                onChangeText={(text) => {
                  const emoji = asEmoji(text);
                  if (emoji) pick(emoji);
                  else setCustom(text);
                }}
                placeholder="Any emoji"
                accessibilityLabel="Type any emoji"
                placeholderTextColor={placeholder}
                className="h-11 flex-1 text-[17px] text-ink"
              />
            </View>
          </Glass>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
