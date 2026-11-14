import { useEffect, useMemo, type ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { SessionProvider } from "@teal/client/session";
import { ButtonRow, Glass, Heading, Icon, LinkButton, WindowBackdrop } from "~/ds";
import { startAuth, useAuth } from "~/lib/auth";
import { themeBootScript } from "~/lib/theme";
import { Nav } from "~/shell/Nav";
import appCss from "~/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Teal" },
      { name: "description", content: "What your friends are listening to, right now." },
      { name: "theme-color", content: "#0b7a73" },
      { property: "og:site_name", content: "teal.fm" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://coverartarchive.org" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Hands the signed-in account to the shared hooks in @teal/client. */
function AuthSession({ children }: { children: ReactNode }) {
  const status = useAuth((state) => state.status);
  const agent = useAuth((state) => state.agent);
  useEffect(() => {
    void startAuth();
  }, []);
  const value = useMemo(
    () => ({ agent, viewer: status === "loggedIn" ? agent?.did : undefined }),
    [agent, status],
  );
  return <SessionProvider value={value}>{children}</SessionProvider>;
}

function RootLayout() {
  return (
    <AuthSession>
      <WindowBackdrop />
      <div className="flex min-h-dvh">
        <Nav />
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </AuthSession>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Glass className="flex w-full max-w-md flex-col items-center gap-3 p-7 text-center">
        <Icon icon={CircleAlert} size={40} className="text-ink-2" />
        <Heading level={1} size="title">
          Page not found
        </Heading>
        <p className="text-[15px] text-ink-2">This link may be incomplete, or the page may have moved.</p>
        <ButtonRow className="justify-center">
          <LinkButton href="/" label="Go to Today" />
          <LinkButton href="/search" label="Explore music" variant="secondary" />
        </ButtonRow>
      </Glass>
    </div>
  );
}
