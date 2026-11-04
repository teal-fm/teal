import { Pressable, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { cn } from "@/lib/utils";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type TabItem<T extends string> = { value: T; label: string; count?: number; icon?: LucideIcon };

/** An underlined tab row. Arrow keys move between tabs on the web. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  // Arrow keys, Home, and End move both the selection and keyboard focus (WAI-ARIA tabs pattern).
  const onKey = (event: KeyboardEvent & { currentTarget: HTMLElement }, index: number) => {
    const target =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : undefined;
    if (target === undefined) return;
    event.preventDefault();
    onChange(tabs[target].value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[target]?.focus();
  };
  return (
    <View role="tablist" aria-label={label} className={cn("flex-row border-b border-hair", className)}>
      {tabs.map((tab, index) => {
        const on = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            accessibilityLabel={tab.count === undefined ? tab.label : `${tab.label}, ${tab.count}`}
            onPress={() => onChange(tab.value)}
            // @ts-expect-error onKeyDown is web-only.
            onKeyDown={(event: KeyboardEvent & { currentTarget: HTMLElement }) => onKey(event, index)}
            className={cn(
              "min-h-12 min-w-0 flex-1 flex-row items-center justify-center gap-1.5 border-b-2 px-1",
              on ? "border-ink" : "border-transparent",
            )}
          >
            {tab.icon ? <Icon icon={tab.icon} size={17} className={on ? "text-ink" : "text-ink-2"} /> : null}
            <Text className={cn("text-[14px]", on ? "font-bold text-ink" : "font-semibold text-ink-2")} numberOfLines={1}>
              {tab.label}
            </Text>
            {tab.count !== undefined ? (
              <Text className="text-[12px] tabular-nums text-ink-2">{tab.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
