import { ReactNode } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  View,
  type ScrollViewProps,
} from "react-native";
import { Link, usePathname } from "expo-router";
import useIsMobile from "@/hooks/useIsMobile";
import ToggleTheme from "@/components/toggleTheme";
import { buildInfo } from "@/lib/buildInfo";
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
} from "lucide-react-native";

import { Text } from "../ui/text";

type TealShellProps = {
  children: ReactNode;
  rightRail?: ReactNode;
  title?: string;
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
        <Text className="text-[11px] font-light text-primary">
          listening network
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
  const tealHandle = normalizeHandle(
    (profile?.teal as { handle?: string } | null | undefined)?.handle,
  );
  const bskyHandle = normalizeHandle(profile?.bsky?.handle);
  const displayName =
    profile?.teal?.displayName ||
    profile?.bsky?.displayName ||
    tealHandle ||
    bskyHandle ||
    "Your profile";
  const handle = tealHandle || bskyHandle;
  const avatar = agent?.did
    ? getProfileImageUrl(
        agent.did,
        profile?.teal?.avatar || profile?.bsky?.avatar,
        "avatar",
      )
    : undefined;

  return (
    <View className="hidden w-[16rem] shrink-0 border-r border-border bg-background/55 px-5 py-7 lg:flex">
      <RecordLogo />
      <ToggleTheme />
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
                  ? handle
                    ? `@${handle}`
                    : "Manage your Teal identity"
                  : "with ATProto"}
              </Text>
            </View>
          </Pressable>
        </Link>
        <View className="mt-5 gap-1 px-1">
          <Text className="font-mono text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
            Running build
          </Text>
          <Text
            className="font-mono text-[11px] leading-4 text-foreground"
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {buildInfo.branch} · {buildInfo.commit.slice(0, 12)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const status = useStore((state) => state.status);
  const items = [
    { href: "/", icon: Home, active: pathname === "/" },
    { href: "/search", icon: Search, active: pathname.includes("search") },
    ...(status === "loggedIn"
      ? [{ href: "/manual-listens", icon: Disc3, active: pathname.startsWith("/manual-listens") }]
      : []),
    {
      href: "/notifications",
      icon: Bell,
      active: pathname.includes("notifications"),
    },
    { href: "/auth/login", icon: CircleUserRound, active: false },
  ];
  return (
    <View className="absolute bottom-4 left-4 right-4 z-30 flex-row items-center justify-around rounded-lg border border-border bg-popover/95 p-2 shadow-lg lg:hidden">
      {items.map((item) => (
        <Link key={item.href} href={item.href as any} asChild>
          <Pressable
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
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
}) {
  return (
    <View className="mb-4 flex-row items-end justify-between gap-4">
      <View className="min-w-0 flex-1">
        {eyebrow && (
          <Text className="mb-1 text-xs font-light text-primary">
            {eyebrow}
          </Text>
        )}
        <Text className="font-sans text-2xl font-semibold">{title}</Text>
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
  onScroll,
}: TealShellProps) {
  const isMobile = useIsMobile();

  return (
    <View
      className="min-h-screen flex-1 bg-background"
      style={landingBackgroundStyle}
    >
      <View className="z-20 flex-row items-center border-b border-border bg-background/55 px-3 py-2">
        <Text className="flex-1 text-center text-[11px] font-light text-primary">
          {
            "this is an early early work in progress!! 🚧 expect bugs, missing features, and regular database wipes"
          }
        </Text>
        <View className="ml-3 lg:hidden">
          <ToggleTheme compact />
        </View>
      </View>
      <View className="z-10 flex-1 flex-row">
        <LeftRail />
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center pb-28 lg:pb-10"
          onScroll={onScroll}
          scrollEventThrottle={onScroll ? 200 : undefined}
        >
          <View className="min-h-screen w-full max-w-[48rem] px-4 py-7 md:px-7 lg:px-8">
            {title && (
              <Text className="mb-7 font-sans text-4xl font-semibold">
                {title}
              </Text>
            )}
            {children}
          </View>
        </ScrollView>
        {!isMobile && rightRail && (
          <View className="hidden w-[19rem] shrink-0 border-l border-border bg-background/55 px-5 py-7 xl:flex">
            {rightRail}
          </View>
        )}
      </View>
      <MobileNav />
    </View>
  );
}
