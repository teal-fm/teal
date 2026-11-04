import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Link, type Href } from "expo-router";
import { cn } from "@/lib/utils";

import { Glass } from "./Glass";
import { Heading, Text } from "./Text";

/** A titled block of a page. Pass `panel` to set its contents in glass. */
export function Section({
  title,
  detail,
  more,
  panel,
  children,
  className,
}: {
  title: string;
  /** A short note beside the title, such as a count or period. */
  detail?: string;
  /** A "See all" style link. */
  more?: { label: string; href: Href };
  panel?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const header = (
    <View className="mb-3 flex-row items-end justify-between gap-3">
      <Heading level={2} onBackdrop={!panel} className="min-w-0 flex-1">
        {title}
      </Heading>
      {more ? (
        <Link href={more.href} asChild>
          <Pressable accessibilityRole="link" className="min-h-9 justify-center">
            <Text onBackdrop={!panel} className="text-[15px] font-semibold text-tint">
              {more.label}
            </Text>
          </Pressable>
        </Link>
      ) : detail ? (
        <Text onBackdrop={!panel} className="pb-0.5 text-[14px] tabular-nums text-ink-2">
          {detail}
        </Text>
      ) : null}
    </View>
  );
  if (panel) {
    return (
      <Glass className={cn("p-4", className)}>
        {header}
        {children}
      </Glass>
    );
  }
  return (
    <View className={className}>
      {header}
      {children}
    </View>
  );
}

/** A tappable row: something leading (cover, avatar), a title and line, and something trailing. */
export function Row({
  href,
  onPress,
  leading,
  title,
  subtitle,
  meta,
  trailing,
  label,
  divider = true,
}: {
  href?: Href;
  onPress?: () => void;
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  /** The accessible name when the visible text isn't enough. */
  label?: string;
  divider?: boolean;
}) {
  const body = (
    <View className={cn("flex-row items-center gap-3 py-2.5", divider && "border-b border-hair")}>
      {leading}
      <View className="min-w-0 flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[14px] text-ink-2" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text className="text-[13px] tabular-nums text-ink-2" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
  if (href) {
    return (
      <Link href={href} asChild>
        <Pressable accessibilityLabel={label} className="web:hover:opacity-80 active:opacity-70">
          {body}
        </Pressable>
      </Link>
    );
  }
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="active:opacity-70">
        {body}
      </Pressable>
    );
  }
  return body;
}
