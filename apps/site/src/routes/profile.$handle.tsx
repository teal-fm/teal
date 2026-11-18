import { createFileRoute } from "@tanstack/react-router";

import { Avatar } from "~/components/Avatar";
import { Card } from "~/components/Card";
import { Header } from "~/components/Header";
import { NowPlaying } from "~/components/NowPlaying";
import { PeriodTabs } from "~/components/PeriodTabs";
import { PlayList } from "~/components/PlayList";
import { ArtistRanking, TrackRanking } from "~/components/Rankings";
import { getProfilePage } from "~/lib/api";
import { displayName, plural } from "~/lib/format";
import { PERIOD_LABELS, periodOf, type Period } from "~/lib/types";

const PROFILE_PERIODS: Period[] = ["week", "month", "year", "all"];

export const Route = createFileRoute("/profile/$handle")({
  validateSearch: (search: Record<string, unknown>): { period?: Period } => {
    const period = periodOf(search.period, "month");

    return period === "month" ? {} : { period };
  },
  loaderDeps: ({ search }) => ({ period: search.period ?? "month" }),
  loader: ({ params, deps }) =>
    getProfilePage({ data: { actor: params.handle, period: deps.period } }),
  head: ({ loaderData }) => {
    const name = loaderData
      ? displayName(loaderData.profile, loaderData.profile.did)
      : "Listener";

    return { meta: [{ title: `${name} · teal.fm` }] };
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, stats, plays, nowPlaying } = Route.useLoaderData();
  const { period } = Route.useLoaderDeps();
  const name = displayName(profile, profile.did);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-4 sm:gap-6">
          <Avatar profile={profile} size={88} />
          <div className="min-w-0">
            <h1 className="font-display truncate text-3xl font-medium sm:text-4xl">
              {name}
            </h1>
            {profile.handle && (
              <a
                href={`https://bsky.app/profile/${profile.did}`}
                className="text-neutral-600 hover:underline dark:text-teal-100/60"
              >
                @{profile.handle}
              </a>
            )}
            <p className="mt-1 text-sm text-neutral-600 dark:text-teal-100/60">
              {plural(stats.totalPlays, "listen")} all time
            </p>
            <NowPlaying
              key={profile.did}
              did={profile.did}
              initial={nowPlaying}
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <p className="text-neutral-600 dark:text-teal-100/60">
            {period !== "all" &&
              `${plural(stats.plays, "listen")} ${PERIOD_LABELS[period].toLowerCase()}`}
          </p>
          <PeriodTabs value={period} periods={PROFILE_PERIODS} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card title="Top artists">
            <ArtistRanking artists={stats.artists} />
          </Card>
          <Card title="Top tracks">
            <TrackRanking tracks={stats.tracks} />
          </Card>
          <Card title="Top albums">
            <TrackRanking tracks={stats.releases} />
          </Card>
        </div>

        <div className="mt-4">
          <Card title="Listens">
            <PlayList initial={plays} did={profile.did} />
          </Card>
        </div>
      </main>
    </>
  );
}
