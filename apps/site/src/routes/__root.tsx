import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

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

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
        <script
          defer
          src="https://watson.nat.vg/script.js"
          data-website-id="178e2b45-4d3a-4222-be83-c73ad1ef8b23"
        />
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
