import { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  View,
  type ScrollViewProps,
} from "react-native";
import { Link, usePathname } from "expo-router";
import useIsMobile from "@/hooks/useIsMobile";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import {
  Bell,
  CircleUserRound,
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

function RecordLogo() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-full border-[5px] border-foreground">
        <View className="h-3 w-3 rounded-full bg-secondary" />
      </View>
      <View>
        <Text className="font-sans text-3xl font-black leading-8">Teal</Text>
        <Text className="font-mono text-[10px] uppercase text-muted-foreground">
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
          active ? "bg-accent" : "web:hover:bg-accent/60"
        }`}
      >
        <Icon
          icon={icon}
          size={20}
          className={active ? "text-primary" : "text-muted-foreground"}
        />
        <Text
          className={
            active ? "font-black text-foreground" : "font-bold text-foreground"
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

  return (
    <View className="hidden w-[16rem] shrink-0 border-r border-border bg-background/95 px-5 py-7 lg:flex">
      <RecordLogo />
      <View className="mt-12 gap-1">
        <NavItem href="/" icon={Home} label="Home" active={pathname === "/"} />
        <NavItem
          href="/search"
          icon={Search}
          label="Explore"
          active={pathname.includes("search")}
        />
        <NavItem
          href="/notifications"
          icon={Bell}
          label="Notifications"
          active={pathname.includes("notifications")}
        />
      </View>
      <View className="mt-auto border-t border-border pt-5">
        <Text className="mb-3 font-mono text-[10px] uppercase text-muted-foreground">
          ATProto appview
        </Text>
        <Link
          href={
            status === "loggedIn" && agent?.did
              ? (`/profile/${agent.did}` as any)
              : ("/auth/login" as any)
          }
          asChild
        >
          <Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3 web:hover:border-primary/50">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
              <Icon
                icon={status === "loggedIn" ? CircleUserRound : LogIn}
                size={18}
                className="text-primary-foreground"
              />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-black">
                {status === "loggedIn" ? "Your profile" : "Sign in"}
              </Text>
              <Text
                className="font-mono text-[10px] text-muted-foreground"
                numberOfLines={1}
              >
                {status === "loggedIn"
                  ? "Manage your Teal identity"
                  : "with ATProto"}
              </Text>
            </View>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const items = [
    { href: "/", icon: Home, active: pathname === "/" },
    { href: "/search", icon: Search, active: pathname.includes("search") },
    {
      href: "/notifications",
      icon: Bell,
      active: pathname.includes("notifications"),
    },
    { href: "/auth/login", icon: CircleUserRound, active: false },
  ];
  return (
    <View className="absolute bottom-4 left-4 right-4 z-30 flex-row items-center justify-around rounded-lg border border-border bg-background/95 p-2 shadow-lg lg:hidden">
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
          <Text className="mb-1 font-mono text-[10px] uppercase text-primary">
            {eyebrow}
          </Text>
        )}
        <Text className="font-sans text-2xl font-black">{title}</Text>
      </View>
      {detail && (
        <Text className="font-mono text-[10px] text-muted-foreground">
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
    <View className="min-h-screen flex-1 bg-background">
      <View className="z-20 flex-row items-center justify-center gap-2 border-b border-border bg-foreground px-3 py-2">
        <Icon icon={Radio} size={13} className="text-secondary" />
        <Text className="font-mono text-[10px] uppercase text-background">
          Live ATProto index · early preview
        </Text>
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
              <Text className="mb-7 font-sans text-4xl font-black">
                {title}
              </Text>
            )}
            {children}
          </View>
        </ScrollView>
        {!isMobile && rightRail && (
          <View className="hidden w-[19rem] shrink-0 border-l border-border bg-foreground px-5 py-7 xl:flex">
            {rightRail}
          </View>
        )}
      </View>
      <MobileNav />
    </View>
  );
}
