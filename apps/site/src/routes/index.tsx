import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import { Account } from "~/components/Account";
import { Card } from "~/components/Card";
import { Landing } from "~/components/Landing";
import { LivePlays } from "~/components/LivePlays";
import { Logo } from "~/components/Logo";
import { PeriodTabs } from "~/components/PeriodTabs";
import {
  ArtistRanking,
  ListenerRanking,
  TrackRanking,
} from "~/components/Rankings";
import { SearchBox } from "~/components/SearchBox";
import { getHome } from "~/lib/api";
import { plural } from "~/lib/format";
import { PERIOD_LABELS, periodOf, type Period } from "~/lib/types";

const HOME_PERIODS: Period[] = ["day", "week", "month", "all"];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { period?: Period } => {
    const period = periodOf(search.period, "week");

    return period === "week" ? {} : { period };
  },
  loaderDeps: ({ search }) => ({ period: search.period ?? "week" }),
  loader: ({ deps }) => getHome({ data: deps }),
  component: Home,
});

const NO_PLAYS = { plays: [], profiles: {} };

type HomeData = NonNullable<Awaited<ReturnType<typeof getHome>>>;

function Home() {
  const home = Route.useLoaderData();
  const { period } = Route.useLoaderDeps();

  return (
    <>
      <div className="mx-auto flex max-w-5xl justify-end px-4 pt-5 sm:px-6 lg:px-8">
        <Account />
      </div>
      <header className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 pb-14 pt-10 text-center sm:pt-18">
        <h1>
          <Logo />
        </h1>
        <p className="text-2xl font-light text-teal-700 dark:text-teal-100 sm:text-3xl">
          Your music,{" "}
          <span className="font-display font-medium text-teal-500">
            beautifully
          </span>{" "}
          tracked.
        </p>
        <div className="mt-4 w-full">
          <SearchBox />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Jetstream keeps this going even when HappyView is down. */}
        <LivePlays initial={home?.recent ?? NO_PLAYS} />

        <section className="mt-14">
          {home ? (
            <Boards {...home} period={period} />
          ) : (
            <p className="text-center text-neutral-600 dark:text-teal-100/60">
              The leaderboard is taking a breather. Check back in a minute.
            </p>
          )}
        </section>

        <a
          href="#features"
          aria-label="More about teal.fm"
          className="mx-auto mt-16 flex w-fit flex-col items-center text-sm text-teal-700 dark:text-teal-300"
        >
          What's teal.fm?
          <ChevronDown
            aria-hidden
            className="size-6 animate-bounce motion-reduce:animate-none"
          />
        </a>
      </main>

      <Landing />
    </>
  );
}

function Boards({
  leaderboard,
  profiles,
  period,
}: HomeData & { period: Period }) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-medium">Leaderboard</h2>
          <p className="text-neutral-600 dark:text-teal-100/60">
            {plural(leaderboard.plays, "listen")} from{" "}
            {plural(leaderboard.listenerCount, "person", "people")}{" "}
            {period === "all" ? "so far" : PERIOD_LABELS[period].toLowerCase()}
          </p>
        </div>
        <PeriodTabs value={period} periods={HOME_PERIODS} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Top listeners">
          <ListenerRanking
            listeners={leaderboard.listeners}
            profiles={profiles}
          />
        </Card>
        <Card title="Top artists">
          <ArtistRanking artists={leaderboard.artists} />
        </Card>
        <Card title="Top tracks">
          <TrackRanking tracks={leaderboard.tracks} />
        </Card>
      </div>
    </>
  );
}
