import { useCallback, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Head from "expo-router/head";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { cn } from "@teal/client/utils";

import { AmbientScreen, useAmbientScroll } from "./ambient";
import { Glass } from "./Glass";
import { Icon } from "./Icon";
import { Heading, Text } from "./Text";

/** Widths the shell switches at on large screens. */
export const BREAKPOINTS = { sidebar: 1000, rail: 1280 } as const;

/** Bottom space so content clears the floating tab bar on phones. */
export const TAB_BAR_CLEARANCE = 110;

export function useLayout() {
  const { width } = useWindowDimensions();
  const web = Platform.OS === "web";
  return {
    width,
    sidebar: web && width >= BREAKPOINTS.sidebar,
    rail: web && width >= BREAKPOINTS.rail,
    phone: width < 700,
  };
}

/** Sets the browser tab title while the screen is focused. */
export function PageTitle({ title }: { title?: string }) {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  if (!focused || !title) return null;
  return (
    <Head>
      <title>{`${title} · Teal`}</title>
    </Head>
  );
}

/** Goes back within the tab, or to Today when the page was opened directly. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function BackButton({ label = "Back" }: { label?: string }) {
  return (
    <Pressable onPress={goBack} accessibilityRole="button" className="self-start active:opacity-70">
      <Glass className="h-10 flex-row items-center gap-0.5 rounded-full pl-2 pr-4">
        <Icon icon={ChevronLeft} size={22} />
        <Text className="font-semibold">{label}</Text>
      </Glass>
    </Pressable>
  );
}

type ScreenProps = {
  children: ReactNode;
  /** The browser tab title. */
  pageTitle?: string;
  /** A large screen title, rendered as the page's h1. */
  title?: string;
  subtitle?: string;
  /** Controls beside the title. */
  actions?: ReactNode;
  back?: boolean;
  /** A right-hand column on wide screens. */
  rail?: ReactNode;
  width?: "narrow" | "wide";
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

/**
 * A page: the blurred-cover backdrop, a scroll area that clears the safe area
 * and tab bar, a centred column, and an optional rail on wide screens.
 */
export function Screen(props: ScreenProps) {
  return (
    <AmbientScreen>
      <ScreenBody {...props} />
    </AmbientScreen>
  );
}

function ScreenBody({
  children,
  pageTitle,
  title,
  subtitle,
  actions,
  back,
  rail,
  width = "narrow",
  onScroll,
  refreshControl,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const ambientScroll = useAmbientScroll();
  const showRail = layout.rail && !!rail;

  return (
    <View className="flex-1 flex-row justify-center">
      <PageTitle title={pageTitle ?? title} />
      <ScrollView
        role="main"
        className="flex-1"
        contentContainerClassName="items-center"
        contentContainerStyle={{
          paddingTop: insets.top + (layout.sidebar ? 28 : 14),
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        }}
        onScroll={(event) => {
          ambientScroll();
          onScroll?.(event);
        }}
        scrollEventThrottle={50}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
      >
        <View className={cn("w-full gap-4 px-4 md:px-6", width === "wide" ? "max-w-[64rem]" : "max-w-[44rem]")}>
          {back ? <BackButton /> : null}
          {title ? (
            <View className="flex-row items-end justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Heading level={1} onBackdrop>
                  {title}
                </Heading>
                {subtitle ? (
                  <Text onBackdrop className="mt-0.5 text-[15px] text-ink-2">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {actions ? <View className="flex-row gap-2 pb-1">{actions}</View> : null}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
      {showRail ? (
        <ScrollView
          role="complementary"
          style={{ width: 360, flexGrow: 0 }}
          contentContainerClassName="gap-3.5 pb-10 pl-2 pr-6"
          contentContainerStyle={{ paddingTop: insets.top + 28 }}
        >
          {rail}
        </ScrollView>
      ) : null}
    </View>
  );
}
