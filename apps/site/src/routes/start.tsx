import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { Header } from "~/components/Header";

const PIPER = "https://github.com/teal-fm/piper";
const MULTI_SCROBBLER = "https://github.com/FoxxMD/multi-scrobbler";
const MS_TEAL_DOCS =
  "https://docs.multi-scrobbler.app/configuration/clients/tealfm/";
const MS_QUICKSTART = "https://docs.multi-scrobbler.app/quickstart/";
const MS_SOURCES = "https://docs.multi-scrobbler.app/configuration/sources/";
const APP_PASSWORDS = "https://bsky.app/settings/app-passwords";
const MALACHITE = "https://malachite.croft.click/";
const MORE_TOOLS = "https://tangled.org/search?q=teal.fm";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "Start tracking · teal.fm" },
      {
        name: "description",
        content:
          "Start tracking your listens on teal.fm with multi-scrobbler or piper, and bring your Last.fm history with you.",
      },
    ],
  }),
  component: StartTracking,
});

function External({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-teal-700 underline decoration-teal-500/40 underline-offset-2 hover:decoration-teal-500 dark:text-teal-300"
    >
      {children}
    </a>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900/90 p-3 text-sm text-teal-50">
      <code>{children}</code>
    </pre>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-4 list-decimal space-y-3 pl-5 marker:font-semibold marker:text-teal-600 dark:marker:text-teal-400">
      {children}
    </ol>
  );
}

function Tool({
  name,
  tagline,
  links,
  children,
}: {
  name: string;
  tagline: string;
  links: { label: string; href: string }[];
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-400/20 bg-gray-100/50 p-5 backdrop-blur-sm sm:p-6 dark:bg-gray-900/50">
      <h2 className="font-display text-2xl font-medium">{name}</h2>
      <p className="mt-1 text-neutral-600 dark:text-teal-100/70">{tagline}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-full border border-teal-500/30 px-3 py-1 text-sm font-medium text-teal-800 transition hover:bg-teal-500/10 dark:text-teal-200"
          >
            {label}
            <ArrowUpRight aria-hidden className="size-3.5" />
          </a>
        ))}
      </div>
      <Steps>{children}</Steps>
    </section>
  );
}

function StartTracking() {
  return (
    <>
      <Header />
      <main className="start-page mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl font-medium sm:text-5xl">
          Start tracking
        </h1>
        <p className="mt-4 text-lg text-neutral-700 dark:text-teal-100/80">
          teal.fm doesn't listen for you. A tracker (a scrobbler) watches what
          you play and saves each listen to your Atmosphere account, the same
          account you use for Bluesky, where teal.fm picks it up. Your listens
          stay in your account, and they're public, just like on Last.fm or
          ListenBrainz.
        </p>
        <p className="mt-3 text-neutral-700 dark:text-teal-100/80">
          Pick one of these to get going. Both run on a computer or server you
          control.
        </p>

        <div className="mt-8 flex flex-col gap-6">
          <Tool
            name="multi-scrobbler"
            tagline="Watches Spotify, Jellyfin, Plex, Last.fm, ListenBrainz and many more, and scrobbles to teal.fm."
            links={[
              { label: "GitHub", href: MULTI_SCROBBLER },
              { label: "teal.fm setup docs", href: MS_TEAL_DOCS },
            ]}
          >
            <li>
              Install it with Docker by following the{" "}
              <External href={MS_QUICKSTART}>quickstart</External>. Its
              dashboard runs on port 9078.
            </li>
            <li>
              Add a <External href={MS_SOURCES}>source</External> for wherever
              you listen, such as Spotify, Jellyfin or Plex.
            </li>
            <li>
              Create an <External href={APP_PASSWORDS}>App Password</External>{" "}
              for your account (on Bluesky: Settings → Privacy and Security →
              App passwords). Save it; it's only shown once.
            </li>
            <li>
              Add teal.fm as a client in your <code>docker-compose.yml</code>,
              with your full handle and that App Password:
              <Code>{`environment:
  - TEALFM_ID=teal
  - TEALFM_IDENTIFIER=alice.bsky.social
  - TEALFM_APP_PW=xxxx-xxxx-xxxx-xxxx`}</Code>
            </li>
            <li>
              Restart it with <code>docker compose up -d</code> and play
              something. Your listen shows up under “Just played” on the home
              page.
            </li>
          </Tool>

          <Tool
            name="piper"
            tagline="teal's own tracker, a small web app that links Spotify, Last.fm, ListenBrainz or Apple Music to your account. Still a work in progress."
            links={[{ label: "GitHub", href: PIPER }]}
          >
            <li>
              Clone the repo and copy <code>.env.template</code> to{" "}
              <code>.env</code>.
            </li>
            <li>
              Give piper a public URL (a port forward, ngrok or a Cloudflare
              Tunnel) and use it for <code>SERVER_ROOT_URL</code> and the{" "}
              <code>ATPROTO_*</code> URLs. Set <code>ALLOWED_DIDS</code> if
              only you should be able to sign in.
            </li>
            <li>
              Generate its OAuth key and put the secret in{" "}
              <code>ATPROTO_CLIENT_SECRET_KEY</code>, with any unique number
              (a timestamp works) in <code>ATPROTO_CLIENT_SECRET_KEY_ID</code>:
              <Code>goat key generate -t P-256</Code>
            </li>
            <li>
              Turn on the services you use (<code>ENABLE_SPOTIFY</code>,{" "}
              <code>ENABLE_LASTFM</code>, <code>ENABLE_LISTENBRAINZ</code>,{" "}
              <code>ENABLE_APPLEMUSIC</code>) and fill in their keys. The
              README explains each one.
            </li>
            <li>
              Start it with Docker, using a version tag from the releases:
              <Code>{`PIPER_IMAGE=ghcr.io/teal-fm/piper:<version> \\
  docker compose -f compose.release.yml up -d`}</Code>
              Then open your URL, sign in with your handle, and link your
              services.
            </li>
          </Tool>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-medium">
            Bring your history
          </h2>
          <p className="mt-2 text-neutral-700 dark:text-teal-100/80">
            Import your Last.fm scrobbles into your account with{" "}
            <External href={MALACHITE}>malachite</External>, by Ewan Croft.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-2xl font-medium">More tools</h2>
          <p className="mt-2 text-neutral-700 dark:text-teal-100/80">
            People keep building trackers for teal.fm. Find more{" "}
            <External href={MORE_TOOLS}>on Tangled</External>.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-2xl font-medium">Say thanks</h2>
          <p className="mt-2 text-neutral-700 dark:text-teal-100/80">
            multi-scrobbler and malachite are made by independent developers.
            Consider sponsoring{" "}
            <External href="https://github.com/sponsors/FoxxMD">
              FoxxMD
            </External>{" "}
            and{" "}
            <External href="https://github.com/sponsors/ewanc26">
              Ewan Croft
            </External>
            . teal.fm takes contributions on{" "}
            <External href="https://opencollective.com/teal">
              Open Collective
            </External>
            .
          </p>
        </section>

        <p className="mt-10">
          <Link
            to="/"
            className="text-teal-700 underline underline-offset-2 dark:text-teal-300"
          >
            Back to teal.fm
          </Link>
        </p>
      </main>
    </>
  );
}
