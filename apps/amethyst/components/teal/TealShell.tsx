import { ReactNode, useCallback, useState } from "react";
import {
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import { useFocusEffect, usePathname } from "expo-router";
import Head from "expo-router/head";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientScreen, useAmbientScroll, useHalo } from "@/components/ds";

import { Text } from "../ui/text";

type TealShellProps = {
  children: ReactNode;
  rightRail?: ReactNode;
  title?: string;
  pageTitle?: string;
  onScroll?: ScrollViewProps["onScroll"];
};

export function SectionHeading({
  eyebrow,
  title,
  detail,
  level = 2,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  level?: 1 | 2 | 3;
}) {
  const halo = useHalo();
  return (
    <View className="mb-4 flex-row items-end justify-between gap-4">
      <View className="min-w-0 flex-1">
        <Text
          role="heading"
          aria-level={level}
          style={halo}
          className={
            level === 1
              ? "text-[34px] font-bold text-ink"
              : "text-[22px] font-bold text-ink"
          }
        >
          {title}
        </Text>
      </View>
      {!!detail && (
        <Text style={halo} className="pb-1 text-[13px] tabular-nums text-ink-2">
          {detail.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
        </Text>
      )}
    </View>
  );
}

/**
 * Page container for screens that have not moved to their redesigned layout yet.
 * Navigation lives in the tab layouts; this only provides the backdrop, a scroll
 * area, an optional title, and a right rail on wide screens.
 */
export default function TealShell(props: TealShellProps) {
  return (
    <AmbientScreen>
      <ShellContent {...props} />
    </AmbientScreen>
  );
}

function ShellContent({
  children,
  rightRail,
  title,
  pageTitle,
  onScroll,
}: TealShellProps) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ambientScroll = useAmbientScroll();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const utilityPage =
    pathname.startsWith("/settings") ||
    pathname.startsWith("/playlist") ||
    pathname.startsWith("/manual-listens") ||
    pathname.startsWith("/stamp") ||
    pathname.includes("/stats/") ||
    pathname.endsWith("/topster");
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    ambientScroll();
    onScroll?.(event);
  };

  return (
    <View className="flex-1 flex-row">
      {focused && !!(pageTitle || title) && (
        <Head>
          <title>{pageTitle || title} · Teal</title>
        </Head>
      )}
      <ScrollView
        role="main"
        accessibilityLabel={title || pageTitle || "Page content"}
        className="flex-1"
        contentContainerClassName="items-center pb-28"
        contentContainerStyle={{ paddingTop: insets.top }}
        onScroll={handleScroll}
        scrollEventThrottle={50}
      >
        <View
          className={`w-full ${utilityPage ? "max-w-[64rem]" : "max-w-[48rem]"} px-4 py-7 md:px-7 lg:px-8`}
        >
          {!!title && (
            <Text
              role="heading"
              aria-level={1}
              className="mb-7 text-[34px] font-bold text-ink"
            >
              {title}
            </Text>
          )}
          {children}
        </View>
      </ScrollView>
      {focused && width >= 1280 && !utilityPage && !!rightRail && (
        <View
          role="complementary"
          accessibilityLabel="More from your circle"
          className="w-[22rem] shrink-0 px-5 py-7"
        >
          {rightRail}
        </View>
      )}
    </View>
  );
}
