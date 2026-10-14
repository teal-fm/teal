import { ReactNode, useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type ScrollViewProps,
} from "react-native";
import { Link, useFocusEffect, usePathname } from "expo-router";
import Head from "expo-router/head";
import ToggleTheme from "@/components/toggleTheme";
import useIsMobile from "@/hooks/useIsMobile";
import { Icon } from "@/lib/icons/iconWithClassName";
import { getProfileImageUrl, normalizeHandle } from "@/lib/teal/actors";
import { useStore } from "@/stores/mainStore";
import {
  Bell,
  CircleUserRound,
  Disc3,
  Home,
  LogIn,
  Radio,
  Search,
  Settings,
} from "lucide-react-native";

import { Text } from "../ui/text";

type TealShellProps = {
  children: ReactNode;
  rightRail?: ReactNode;
  title?: string;
  pageTitle?: string;
  onScroll?: ScrollViewProps["onScroll"];
};

const landingBackgroundStyle = {
  backgroundImage:
    "radial-gradient(circle at 48% 24%, hsl(var(--popover) / 0.78) 0, hsl(var(--popover) / 0) 30rem), linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--accent) / 0.48) 48%, hsl(var(--background)) 100%)",
} as any;

function RecordLogo() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
        <Icon icon={Radio} size={23} className="text-foreground" />
      </View>
      <View>
        <Text className="font-sans text-3xl font-semibold leading-8">
          teal
          <Text className="font-crimson-italic text-3xl font-semibold text-primary">
            .fm
          </Text>
        </Text>
      </View>
    </View>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: any;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href as any} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        className={`flex-row items-center gap-3 rounded-lg px-3 py-3 web:transition-colors ${
          active ? "bg-accent/70" : "web:hover:bg-accent/45"
        }`}
      >
        <Icon
          icon={icon}
          size={20}
          className={active ? "text-primary" : "text-muted-foreground"}
        />
        <Text
          className={
            active
              ? "font-semibold text-foreground"
              : "font-medium text-foreground"
          }
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

function LeftRail() {
  const pathname = usePathname();
  const status = useStore((state) => state.status);
  const agent = useStore((state) => state.pdsAgent);
  const profiles = useStore((state) => state.profiles);
  const profile = agent?.did ? profiles[agent.did] : undefined;
  const tealProfile = profile?.teal as
    | { avatar?: string; displayName?: string; handle?: string }
    | null
    | undefined;
  const tealHandle = normalizeHandle(tealProfile?.handle);
  const displayName =
    tealProfile?.displayName || tealHandle || "Your Teal profile";
  const avatar = agent?.did
    ? getProfileImageUrl(agent.did, tealProfile?.avatar, "avatar")
    : undefined;

  return (
    <View
      role="navigation"
      accessibilityLabel="Main navigation"
      className="hidden w-[16rem] shrink-0 border-r border-border bg-background/55 px-5 py-7 lg:flex"
    >
      <RecordLogo />
      <View className="mt-12 gap-1">
        <NavItem href="/" icon={Home} label="Home" active={pathname === "/"} />
        <NavItem
          href="/search"
          icon={Search}
          label="Explore"
          active={pathname.includes("search")}
        />
        {status === "loggedIn" && (
          <NavItem
            href="/manual-listens"
            icon={Disc3}
            label="Add listens"
            active={pathname.startsWith("/manual-listens")}
          />
        )}
        <NavItem
          href="/notifications"
          icon={Bell}
          label="Notifications"
          active={pathname.includes("notifications")}
        />
        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          active={pathname.startsWith("/settings")}
        />
      </View>
      <View className="mt-auto border-t border-border pt-5">
        <Link
          href={
            status === "loggedIn" && agent?.did
              ? (`/profile/${agent.did}` as any)
              : ("/auth/login" as any)
          }
          asChild
        >
          <Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-card/75 p-3 web:hover:border-primary/50">
            <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary">
              {status === "loggedIn" && avatar ? (
                <Image source={{ uri: avatar }} className="h-full w-full" />
              ) : (
                <Icon
                  icon={status === "loggedIn" ? CircleUserRound : LogIn}
                  size={18}
                  className="text-primary-foreground"
                />
              )}
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold" numberOfLines={1}>
                {status === "loggedIn" ? displayName : "Sign in"}
              </Text>
              <Text
                className="text-xs font-light text-muted-foreground"
                numberOfLines={1}
              >
                {status === "loggedIn"
                  ? tealHandle
                    ? `@${tealHandle}`
                    : "Manage your Teal identity"
                  : "with your Atmosphere account"}
              </Text>
            </View>
          </Pressable>
        </Link>
        <View className="mt-3">
          <ToggleTheme />
        </View>
      </View>
    </View>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const status = useStore((state) => state.status);
  const did = useStore((state) => state.pdsAgent?.did);
  const profileHref =
    status === "loggedIn" && did ? `/profile/${did}` : "/auth/login";
  const items = [
    { href: "/", icon: Home, label: "Home", active: pathname === "/" },
    {
      href: "/search",
      icon: Search,
      label: "Explore",
      active: pathname.includes("search"),
    },
    ...(status === "loggedIn"
      ? [
          {
            href: "/manual-listens",
            icon: Disc3,
            label: "Add listens",
            active:
              pathname.startsWith("/manual-listens") ||
              pathname.startsWith("/stamp"),
          },
        ]
      : []),
    {
      href: "/notifications",
      icon: Bell,
      label: "Notifications",
      active: pathname.includes("notifications"),
    },
    {
      href: profileHref,
      icon: CircleUserRound,
      label: status === "loggedIn" ? "Your profile" : "Sign in",
      active: pathname === profileHref,
    },
  ];
  return (
    <View
      role="navigation"
      accessibilityLabel="Mobile navigation"
      className="absolute bottom-4 left-4 right-4 z-30 flex-row items-center justify-around rounded-lg border border-border bg-popover/95 p-2 shadow-lg lg:hidden"
    >
      {items.map((item) => (
        <Link key={item.href} href={item.href as any} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.active }}
            className={`h-11 w-11 items-center justify-center rounded-lg ${
              item.active ? "bg-accent" : ""
            }`}
          >
            <Icon
              icon={item.icon}
              size={21}
              className={item.active ? "text-primary" : "text-muted-foreground"}
            />
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

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
  return (
    <View className="mb-4 flex-row items-end justify-between gap-4">
      <View className="min-w-0 flex-1">
        <Text
          role="heading"
          aria-level={level}
          className="font-sans text-2xl font-semibold"
        >
          {title}
        </Text>
      </View>
      {detail && (
        <Text className="text-xs font-light text-muted-foreground">
          {detail}
        </Text>
      )}
    </View>
  );
}

export default function TealShell({
  children,
  rightRail,
  title,
  pageTitle,
  onScroll,
}: TealShellProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
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

  return (
    <View
      className="min-h-screen flex-1 bg-background"
      style={landingBackgroundStyle}
    >
      {focused && (pageTitle || title) && (
        <Head>
          <title>{pageTitle || title} · Teal</title>
        </Head>
      )}
      <View className="z-20 flex-row items-center border-b border-border bg-background/55 px-3 py-2">
        <Text className="flex-1 text-center text-[11px] font-light text-primary">
          {
            "this is an early early work in progress!! 🚧 expect bugs, missing features, and regular database wipes"
          }
        </Text>
        <View className="ml-2 flex-row items-center lg:hidden">
          <Link href="/settings" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Settings"
              className="h-11 w-11 items-center justify-center rounded-lg web:hover:bg-accent"
            >
              <Icon icon={Settings} size={20} className="text-foreground" />
            </Pressable>
          </Link>
          <ToggleTheme compact />
        </View>
      </View>
      <View className="z-10 flex-1 flex-row">
        <LeftRail />
        <ScrollView
          role="main"
          accessibilityLabel={title || pageTitle || "Page content"}
          className="flex-1"
          contentContainerClassName="items-center pb-28 lg:pb-10"
          onScroll={onScroll}
          scrollEventThrottle={onScroll ? 200 : undefined}
        >
          <View
            className={`min-h-screen w-full ${utilityPage ? "max-w-[64rem]" : "max-w-[48rem]"} px-4 py-7 md:px-7 lg:px-8`}
          >
            {title && (
              <Text
                role="heading"
                aria-level={1}
                className="mb-7 font-sans text-4xl font-semibold"
              >
                {title}
              </Text>
            )}
            {children}
          </View>
        </ScrollView>
        {focused && width >= 1280 && !isMobile && !utilityPage && rightRail && (
          <View
            role="complementary"
            accessibilityLabel="Trending music"
            className="hidden w-[19rem] shrink-0 border-l border-border bg-background/55 px-5 py-7 xl:flex"
          >
            {rightRail}
          </View>
        )}
      </View>
      <MobileNav />
    </View>
  );
}
