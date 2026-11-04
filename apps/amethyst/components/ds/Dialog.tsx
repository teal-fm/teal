import { useId, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { usePathname } from "expo-router";
import { X } from "lucide-react-native";

import { IconButton } from "./Button";
import { Heading, Text } from "./Text";
import { useDialogFocus } from "./useDialogFocus";

/**
 * A centred sheet for a modal route (sign-in, sign-out). The page underneath stays
 * visible through a dim scrim; on the web focus is trapped and Escape closes it.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useDialogFocus(onClose, titleId, usePathname());
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Pressable
        onPress={onClose}
        accessible={false}
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
      />
      <View
        ref={ref}
        className="w-full max-w-md gap-4 rounded-[26px] border border-glass-edge bg-ground p-6 md:p-7"
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Heading level={1} size="title" nativeID={titleId}>
              {title}
            </Heading>
            {description ? <Text className="text-[15px] text-ink-2">{description}</Text> : null}
          </View>
          <IconButton icon={X} label="Close" size={36} onPress={onClose} />
        </View>
        {children}
      </View>
    </View>
  );
}
