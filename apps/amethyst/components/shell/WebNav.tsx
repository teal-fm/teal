import { Pressable, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import { Link } from "expo-router";
import { Avatar } from "@/components/ds/Avatar";
import { Glass } from "@/components/ds/Glass";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { normalizeHandle } from "@/lib/teal/actors";
import { cn } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import { Bell, Compass, House, Settings, SquarePen, UserRound, type LucideIcon } from "lucide-react-native";

export const WIDE_BREAKPOINT = 1000;

const ITEMS: Record<string, { label: string; href: string; icon?: LucideIcon }> = {
  "(home)": { label: "Today", href: "/", icon: House },
  "(search)": { label: "Explore", href: "/search", icon: Compass },
  "(updates)": { label: "Activity", href: "/notifications", icon: Bell },
  "(you)": { label: "You", href: "/me" },
};

function MeIcon({ me, size, focused }: { me: ReturnType<typeof useMe>; size: number; focused: boolean }) {
  return me.signedIn ? (
    <Avatar did={me.did} avatar={me.avatar} name={me.name} size={size} />
  ) : (
    <Icon icon={UserRound} size={size - 1} className={focused ? "text-tint" : "text-ink-2"} />
  );
}

function useMe() {
  const did = useStore((state) => state.pdsAgent?.did);
  const status = useStore((state) => state.status);
  const profile = did ? useStore.getState().profiles[did] : undefined;
  const teal = profile?.teal as
    | { avatar?: string; displayName?: string; handle?: string }
    | null
    | undefined;
  const handle = normalizeHandle(teal?.handle);
  return {
    did,
    signedIn: status === "loggedIn" && !!did,
    avatar: teal?.avatar,
    name: teal?.displayName || handle || "You",
    handle,
  };
}

/** The tab bar for browsers: a floating frosted sidebar when wide, a pill bar when narrow. */
export function WebNav({ state, navigation, wide }: BottomTabBarProps & { wide: boolean }) {
  const me = useMe();
  const go = (name: string, key: string, focused: boolean, event?: { preventDefault?: () => void }) => {
    // Items are real links so they can open in a new tab; a plain click stays in the app.
    event?.preventDefault?.();
    const press = navigation.emit({ type: "tabPress", target: key, canPreventDefault: true });
    if (!focused && !press.defaultPrevented) navigation.navigate(name);
  };

  const items = state.routes.map((route, index) => {
    const focused = state.index === index;
    const item = ITEMS[route.name] ?? { label: route.name, href: "/" };
    return { route, focused, ...item };
  });

  if (!wide) {
    return (
      <View className="absolute bottom-3.5 left-4 right-4 items-center" pointerEvents="box-none">
        <Glass
          role="navigation"
          aria-label="Tabs"
          strong
          className="h-[62px] w-full max-w-[380px] flex-row items-center justify-around rounded-full px-2"
        >
          {items.map(({ route, focused, label, icon }) => (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={(e) => go(route.name, route.key, focused, e)}
              className={cn(
                "flex-1 items-center gap-0.5 rounded-full py-1.5",
                focused && "bg-fill",
              )}
            >
              {icon ? (
                <Icon icon={icon} size={23} className={focused ? "text-tint" : "text-ink-2"} />
              ) : (
                <MeIcon me={me} size={23} focused={focused} />
              )}
              <Text className={cn("text-[10.5px] font-semibold", focused ? "text-tint" : "text-ink-2")}>
                {label}
              </Text>
            </Pressable>
          ))}
        </Glass>
      </View>
    );
  }

  return (
    <View className="w-[264px] py-4 pl-4">
      <Glass
        role="navigation"
        aria-label="Main"
        strong
        className="flex-1 gap-0.5 rounded-[30px] px-3 pb-3 pt-[22px]"
      >
        <Text className="px-3 pb-[22px] text-[25px] font-extrabold tracking-tight text-tint">
          teal<Text className="text-[25px] font-semibold text-ink-3">.fm</Text>
        </Text>
        {items.map(({ route, focused, label, icon, href }) => (
          <Pressable
            key={route.key}
            accessibilityRole="link"
            accessibilityState={{ selected: focused }}
            aria-current={focused ? "page" : undefined}
            // @ts-expect-error React Native Web renders a pressable with href as an anchor.
            href={href}
            onPress={(e) => go(route.name, route.key, focused, e)}
            className={cn(
              "h-[46px] flex-row items-center gap-[13px] rounded-[15px] px-3 web:transition-colors",
              focused ? "bg-tint-soft" : "web:hover:bg-fill",
            )}
          >
            {icon ? (
              <Icon icon={icon} size={22} className={focused ? "text-tint" : "text-ink-2"} />
            ) : (
              <MeIcon me={me} size={23} focused={focused} />
            )}
            <Text className={cn("text-base font-semibold", focused ? "text-tint" : "text-ink-2")}>
              {label}
            </Text>
          </Pressable>
        ))}
        {me.signedIn ? (
          <Link href="/compose" asChild>
            <Pressable className="mx-0.5 mt-4 h-[46px] flex-row items-center justify-center gap-2 rounded-full bg-tint shadow-lg">
              <Icon icon={SquarePen} size={19} className="text-on-tint" />
              <Text className="text-[15.5px] font-semibold text-on-tint">Post a song</Text>
            </Pressable>
          </Link>
        ) : null}
        <View className="mt-auto gap-3">
          <Text className="px-3 text-[12px] leading-4 text-ink-2">
            Early work in progress: expect bugs and the odd database wipe.
          </Text>
          <View className="flex-row items-center gap-1.5">
          <Link href={me.signedIn ? "/me" : "/auth/login"} asChild>
            <Pressable className="flex-1 flex-row items-center gap-2.5 rounded-[20px] bg-fill p-2.5">
              {me.signedIn ? (
                <Avatar did={me.did} avatar={me.avatar} name={me.name} size={40} />
              ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full bg-tint-soft">
                  <Icon icon={UserRound} size={20} className="text-tint" />
                </View>
              )}
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                  {me.signedIn ? me.name : "Sign in"}
                </Text>
                <Text className="text-[12.5px] text-ink-2" numberOfLines={1}>
                  {me.signedIn ? (me.handle ? `@${me.handle}` : "Your profile") : "with Atmosphere"}
                </Text>
              </View>
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable accessibilityLabel="Settings" className="h-11 w-11 items-center justify-center rounded-full web:hover:bg-fill">
              <Icon icon={Settings} size={20} className="text-ink-2" />
            </Pressable>
          </Link>
          </View>
        </View>
      </Glass>
    </View>
  );
}
