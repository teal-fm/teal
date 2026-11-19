import { useEffect, type ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";

import { AuthProvider } from "~/lib/auth";
import appCss from "~/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "teal.fm - Your music journey, beautifully tracked" },
      {
        name: "description",
        content:
          "See what everyone on teal.fm is listening to: leaderboards, recent listens, and anyone's top artists and tracks.",
      },
      { name: "theme-color", content: "#14b8a6" },
      { property: "og:site_name", content: "teal.fm" },
    ],
    links: [
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,200..900;1,200..900&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  notFoundComponent: NotFound,
  errorComponent: Failed,
});

type PlausibleEvent = { u: string; r: string | null };
type PlausibleOptions = {
  outboundLinks: boolean;
  fileDownloads: boolean;
  formSubmissions: boolean;
  transformRequest: (event: PlausibleEvent) => PlausibleEvent | null;
};

function isOAuthCallback(href: string) {
  const url = new URL(href);
  if (url.hostname !== "teal.fm") return false;
  const params = url.searchParams;
  if (params.has("state") && (params.has("code") || params.has("error"))) {
    return true;
  }
  try {
    const pathname = decodeURI(url.pathname).replace(/\/+$/, "").toLowerCase();
    return pathname === "/oauth/callback";
  } catch {
    return false;
  }
}

function loadAnalytics() {
  if (isOAuthCallback(location.href) || document.getElementById("plausible")) {
    return;
  }

  const script = document.createElement("script");
  script.id = "plausible";
  script.src = "https://plausible.mmatt.net/js/pa-h-gzPjXqnmcu321_1879C.js";
  script.addEventListener(
    "load",
    () => {
      const { plausible } = window as Window & {
        plausible?: { init: (options: PlausibleOptions) => void };
      };
      plausible?.init({
        outboundLinks: false,
        fileDownloads: false,
        formSubmissions: false,
        transformRequest: (event) => {
          if (isOAuthCallback(event.u)) return null;
          return event.r && isOAuthCallback(event.r)
            ? { ...event, r: null }
            : event;
        },
      });
    },
    { once: true },
  );
  document.head.appendChild(script);
}

function Analytics() {
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    if (location.hostname !== "teal.fm") return;
    // Keep the tracker off the critical path and retry after OAuth replaces the URL.
    if (document.readyState === "complete") {
      loadAnalytics();
      return;
    }
    window.addEventListener("load", loadAnalytics, { once: true });
    return () => window.removeEventListener("load", loadAnalytics);
  }, [href]);

  return null;
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-4xl font-medium">{title}</h1>
      <p className="text-neutral-600 dark:text-teal-100/70">{children}</p>
      <Link to="/" className="text-teal-600 underline dark:text-teal-400">
        Back to teal.fm
      </Link>
    </main>
  );
}

function NotFound() {
  return (
    <Message title="Nothing here">
      We couldn't find that page or that person.
    </Message>
  );
}

function Failed() {
  return (
    <Message title="Something skipped">
      We couldn't load listens just now. Try again in a minute.
    </Message>
  );
}
