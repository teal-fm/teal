import { useRouterState } from "@tanstack/react-router";
import { Bell, Compass, House, Settings, SquarePen, UserRound, type LucideIcon } from "lucide-react";
import { normalizeHandle } from "@teal/client/teal/actors";
import { cn } from "@teal/client/utils";
import { A, Avatar, Glass, Icon } from "~/ds";
import { useAuth } from "~/lib/auth";

type Item = { key: string; label: string; href: string; icon?: LucideIcon };

const ITEMS: Item[] = [
  { key: "today", label: "Today", href: "/", icon: House },
  { key: "explore", label: "Explore", href: "/search", icon: Compass },
  { key: "activity", label: "Activity", href: "/notifications", icon: Bell },
  { key: "you", label: "You", href: "/me" },
];

function useMe() {
  const status = useAuth((state) => state.status);
  const did = useAuth((state) => state.agent?.did);
  const teal = useAuth((state) => state.profile?.teal);
  const handle = normalizeHandle(useAuth((state) => state.profile?.bsky?.handle));
  return {
    did,
    signedIn: status === "loggedIn" && !!did,
    avatar: teal?.avatar,
    name: teal?.displayName || handle || "You",
    handle,
  };
}

function useCurrent(me: ReturnType<typeof useMe>) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/") return "today";
  if (pathname.startsWith("/search")) return "explore";
  if (pathname.startsWith("/notifications")) return "activity";
  if (pathname === "/me" || (me.did && pathname.startsWith(`/profile/${me.did}`))) return "you";
  if (me.handle && pathname.startsWith(`/profile/${me.handle}`)) return "you";
  return undefined;
}

function MeIcon({ me, size, on }: { me: ReturnType<typeof useMe>; size: number; on: boolean }) {
  return me.signedIn ? (
    <Avatar did={me.did} avatar={me.avatar} name={me.name} size={size} />
  ) : (
    <Icon icon={UserRound} size={size - 1} className={on ? "text-tint" : "text-ink-2"} />
  );
}

/**
 * Browsers get a floating frosted sidebar on wide screens and a pill tab bar on
 * phones. Both render, and CSS picks one, so the server markup matches any width.
 */
export function Nav() {
  const me = useMe();
  const current = useCurrent(me);
  return (
    <>
      <div className="fixed inset-x-4 bottom-3.5 z-30 flex justify-center nav:hidden">
        <Glass
          as="nav"
          aria-label="Tabs"
          strong
          className="flex h-[62px] w-full max-w-[380px] items-center justify-around rounded-full px-2"
        >
          {ITEMS.map((item) => {
            const on = current === item.key;
            return (
              <A
                key={item.key}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5", on && "bg-fill")}
              >
                {item.icon ? (
                  <Icon icon={item.icon} size={23} className={on ? "text-tint" : "text-ink-2"} />
                ) : (
                  <MeIcon me={me} size={23} on={on} />
                )}
                <span className={cn("text-[10.5px] font-semibold", on ? "text-ink" : "text-ink-2")}>{item.label}</span>
              </A>
            );
          })}
        </Glass>
      </div>

      <div className="sticky top-0 hidden h-dvh w-[264px] shrink-0 py-4 pl-4 nav:block">
        <Glass as="nav" aria-label="Main" strong className="flex h-full flex-col gap-0.5 rounded-[30px] px-3 pt-[22px] pb-3">
          <A href="/" className="px-3 pb-[22px] text-[25px] font-extrabold tracking-tight text-tint">
            teal<span className="font-semibold text-ink-3">.fm</span>
          </A>
          {ITEMS.map((item) => {
            const on = current === item.key;
            return (
              <A
                key={item.key}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-[46px] items-center gap-[13px] rounded-[15px] px-3 text-base font-semibold transition-colors",
                  on ? "bg-tint-soft text-ink" : "text-ink-2 hover:bg-fill",
                )}
              >
                {item.icon ? (
                  <Icon icon={item.icon} size={22} className={on ? "text-tint" : "text-ink-2"} />
                ) : (
                  <MeIcon me={me} size={23} on={on} />
                )}
                {item.label}
              </A>
            );
          })}
          {me.signedIn ? (
            <A
              href="/compose"
              className="mx-0.5 mt-4 flex h-[46px] items-center justify-center gap-2 rounded-full bg-tint text-[15.5px] font-semibold text-on-tint shadow-lg hover:brightness-95"
            >
              <Icon icon={SquarePen} size={19} className="text-on-tint" />
              Post a song
            </A>
          ) : null}
          <div className="mt-auto flex flex-col gap-3">
            <p className="px-3 text-[12px] leading-4 text-ink-2">Early work in progress: expect bugs and the odd database wipe.</p>
            <div className="flex items-center gap-1.5">
              <A
                href={me.signedIn ? "/me" : "/auth/login"}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[20px] bg-fill p-2.5 hover:brightness-95"
              >
                {me.signedIn ? (
                  <Avatar did={me.did} avatar={me.avatar} name={me.name} size={40} />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-full bg-tint-soft">
                    <Icon icon={UserRound} size={20} className="text-tint" />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold text-ink">{me.signedIn ? me.name : "Sign in"}</span>
                  <span className="truncate text-[12.5px] text-ink-2">
                    {me.signedIn ? (me.handle ? `@${me.handle}` : "Your profile") : "with Atmosphere"}
                  </span>
                </span>
              </A>
              <A
                href="/settings"
                aria-label="Settings"
                title="Settings"
                className="flex size-11 items-center justify-center rounded-full hover:bg-fill"
              >
                <Icon icon={Settings} size={20} className="text-ink-2" />
              </A>
            </div>
          </div>
        </Glass>
      </div>
    </>
  );
}
