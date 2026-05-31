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
import { Bell, Home, LogIn, Search, UserCircle } from "lucide-react-native";

import { Text } from "../ui/text";

type SongishShellProps = {
  children: ReactNode;
  rightRail?: ReactNode;
  title?: string;
  onScroll?: ScrollViewProps["onScroll"];
};

function RecordLogo() {
  return (
    <View className="items-center">
      <View className="h-24 w-24 items-center justify-center rounded-full border-[10px] border-foreground bg-background shadow-lg">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-foreground">
          <View className="h-4 w-4 rounded-full bg-background" />
        </View>
      </View>
      <Text className="-mt-5 font-serif text-5xl font-black text-foreground web:drop-shadow-lg">
        Teal
      </Text>
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
      <Pressable className="flex-row items-center gap-4 rounded-xl p-3 web:hover:bg-background/60">
        <Icon
          icon={icon}
          size={36}
          className={active ? "text-foreground" : "text-muted-foreground"}
        />
        <Text
          className={
            active
              ? "text-2xl font-black text-foreground"
              : "text-2xl font-black text-muted-foreground"
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
    <View className="hidden w-[25rem] shrink-0 items-center px-8 py-10 lg:flex">
      <RecordLogo />
      <View className="mt-16 w-full rounded-2xl bg-background/55 p-4 backdrop-blur-xl">
        <NavItem href="/" icon={Home} label="Home" active={pathname === "/"} />
        <NavItem
          href="/notifications"
          icon={Bell}
          label="Notifications"
          active={pathname.includes("notifications")}
        />
        <NavItem
          href="/search"
          icon={Search}
          label="Explore"
          active={pathname.includes("search")}
        />
      </View>
      <Link
        href={
          status === "loggedIn" && agent?.did
            ? (`/profile/${agent.did}` as any)
            : ("/auth/login" as any)
        }
        asChild
      >
        <Pressable className="mt-14 w-full flex-row items-center justify-between rounded-2xl bg-background/65 p-5 backdrop-blur-xl web:hover:bg-background/80">
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-xl bg-foreground">
              <Icon
                icon={status === "loggedIn" ? UserCircle : LogIn}
                size={28}
                className="text-background"
              />
            </View>
            <Text className="text-2xl font-black">
              {status === "loggedIn" ? "Profile" : "Login"}
            </Text>
          </View>
          <Text className="text-3xl">→</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <View className="absolute bottom-4 left-4 right-4 z-30 flex-row items-center justify-around rounded-3xl bg-background/75 p-4 backdrop-blur-xl lg:hidden">
      <Link href="/" asChild>
        <Pressable>
          <Icon
            icon={Home}
            size={34}
            className={
              pathname === "/" ? "text-foreground" : "text-muted-foreground"
            }
          />
        </Pressable>
      </Link>
      <Link href="/notifications" asChild>
        <Pressable>
          <Icon
            icon={Bell}
            size={34}
            className={
              pathname.includes("notifications")
                ? "text-foreground"
                : "text-muted-foreground"
            }
          />
        </Pressable>
      </Link>
      <Link href="/search" asChild>
        <Pressable>
          <Icon
            icon={Search}
            size={38}
            className={
              pathname.includes("search")
                ? "text-foreground"
                : "text-muted-foreground"
            }
          />
        </Pressable>
      </Link>
      <Link href="/auth/login" asChild>
        <Pressable className="h-12 w-12 items-center justify-center rounded-full bg-foreground/30">
          <Icon icon={LogIn} size={24} className="text-foreground" />
        </Pressable>
      </Link>
    </View>
  );
}

export default function SongishShell({
  children,
  rightRail,
  title,
  onScroll,
}: SongishShellProps) {
  const isMobile = useIsMobile();

  return (
    <View className="min-h-screen flex-1 bg-background">
      <View className="absolute inset-0 bg-[linear-gradient(110deg,#ffffff_0%,#ffffff_34%,#8fb4ff_60%,#0a43ff_100%)] dark:bg-[linear-gradient(110deg,#08040b_0%,#13091a_38%,#26356f_68%,#0f49ff_100%)]" />
      <Text className="z-20 h-7 text-center text-sm font-black">
        teal is in active development: expect bugs, missing features, and
        regular index rebuilds
      </Text>
      <View className="z-10 flex-1 flex-row">
        <LeftRail />
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center pb-28 lg:pb-10"
          onScroll={onScroll}
          scrollEventThrottle={onScroll ? 200 : undefined}
        >
          <View className="min-h-screen w-full max-w-[42rem] rounded-t-3xl bg-background/60 px-3 py-8 backdrop-blur-xl md:px-8">
            {title && (
              <Text className="mb-8 text-center font-serif text-5xl font-black">
                {title}
              </Text>
            )}
            {children}
          </View>
        </ScrollView>
        {!isMobile && (
          <View className="hidden w-[25rem] shrink-0 px-5 py-12 lg:flex">
            {rightRail}
          </View>
        )}
      </View>
      <MobileNav />
    </View>
  );
}
