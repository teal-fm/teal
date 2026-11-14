import { useEffect, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@teal/client/utils";

import { AmbientScreen } from "./ambient";
import { Icon } from "./Icon";
import { Heading } from "./Text";

/** Sets the tab title for titles only known after data loads. Route `head()` sets the first one. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    if (title) document.title = `${title} · Teal`;
  }, [title]);
}

/** Goes back within the app, or to Today when the page was opened directly. */
export function useGoBack() {
  const router = useRouter();
  return () => {
    if (router.history.canGoBack()) router.history.back();
    else void router.navigate({ to: "/", replace: true });
  };
}

export function BackButton({ label = "Back" }: { label?: string }) {
  const back = useGoBack();
  return (
    <button
      type="button"
      onClick={back}
      className="flex h-10 items-center gap-0.5 self-start rounded-full border border-glass-edge bg-glass pr-4 pl-2 font-semibold backdrop-blur-2xl backdrop-saturate-150 active:opacity-70"
    >
      <Icon icon={ChevronLeft} size={22} />
      {label}
    </button>
  );
}

type ScreenProps = {
  children: ReactNode;
  /** The tab title, when it differs from the heading or arrives with data. */
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
};

/**
 * A page: the blurred-cover backdrop, a centred column that clears the tab bar
 * on phones, and an optional sticky rail on wide screens.
 */
export function Screen({ children, pageTitle, title, subtitle, actions, back, rail, width = "narrow" }: ScreenProps) {
  useDocumentTitle(pageTitle ?? title);
  return (
    <AmbientScreen>
      <div className="flex justify-center">
        <main
          className={cn(
            "flex w-full min-w-0 flex-col gap-4 px-4 pt-3.5 pb-[110px] md:px-6 nav:pt-7 nav:pb-10",
            width === "wide" ? "max-w-[64rem]" : "max-w-[44rem]",
          )}
        >
          {back ? <BackButton /> : null}
          {title ? (
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Heading level={1} onBackdrop>
                  {title}
                </Heading>
                {subtitle ? <p className="halo mt-0.5 text-[15px] text-ink-2">{subtitle}</p> : null}
              </div>
              {actions ? <div className="flex gap-2 pb-1">{actions}</div> : null}
            </div>
          ) : null}
          {children}
        </main>
        {rail ? (
          <aside className="sticky top-0 hidden max-h-dvh w-[360px] shrink-0 flex-col gap-3.5 overflow-y-auto pt-7 pr-6 pb-10 pl-2 scrollbar-none rail:flex">
            {rail}
          </aside>
        ) : null}
      </div>
    </AmbientScreen>
  );
}
