import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { getArtist, getArtistImageUrl, getArtistListeners } from "@teal/client/teal/api";
import { countLabel, discography, LISTENER_PERIODS, normalizeListenerPeriod } from "@teal/client/teal/music";
import { musicArtistListenersHref } from "@teal/client/teal/routes";
import { Choices, coverUri, ErrorNotice, LinkButton, Loading, Screen, Section } from "~/ds";
import { Leaderboard } from "~/components/music/Leaderboard";
import { MusicHero } from "~/components/music/MusicHero";
import { ReleaseGrid } from "~/components/music/ReleaseGrid";
import { once, pageMeta, serverAwait } from "~/lib/meta";
import { pickStrings } from "~/lib/search";

const artistQuery = (mbid?: string, name?: string) => ({
  queryKey: ["artist", mbid, name] as const,
  queryFn: () => getArtist(mbid, name).then((r) => r.artist),
});

export const Route = createFileRoute("/music/$artist/")({
  validateSearch: (search: Record<string, unknown>) => pickStrings(search, "mbid", "name", "period"),
  loaderDeps: ({ search }) => ({ mbid: search.mbid, name: search.name }),
  loader: ({ params, deps, context: { queryClient } }) =>
    serverAwait(async () => {
      const artist = await queryClient.ensureQueryData(once(artistQuery(deps.mbid, deps.name || params.artist)));
      return {
        title: artist.name,
        description: `${countLabel(artist.playCount, "listen")} on Teal`,
        image: coverUri(artist.albums[0]?.mbid),
      };
    }),
  head: ({ loaderData }) => ({ meta: loaderData ? pageMeta(loaderData) : [{ title: "Artist · Teal" }] }),
  component: ArtistScreen,
});

/** An artist: who they are on teal, who listens most, and their releases. */
function ArtistScreen() {
  const { artist: slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const lookup = search.name || slug;
  const period = normalizeListenerPeriod(search.period);

  const artist = useQuery(artistQuery(search.mbid, lookup));
  const photo = useQuery({
    queryKey: ["artist-image", artist.data?.mbid],
    queryFn: async () => (await getArtistImageUrl(artist.data!.mbid, 500)) ?? null,
    enabled: !!artist.data?.mbid,
    staleTime: (query) => (query.state.data ? Infinity : 10 * 60_000),
  });
  const listeners = useQuery({
    queryKey: ["artist-listeners", search.mbid, lookup, period, 5],
    queryFn: () => getArtistListeners(search.mbid, lookup, period, 5).then((r) => r.listeners),
  });

  if (artist.isLoading) {
    return (
      <Screen back pageTitle="Artist">
        <Loading />
      </Screen>
    );
  }
  if (artist.isError || !artist.data) {
    return (
      <Screen back pageTitle="Artist">
        <ErrorNotice title="This artist didn't load" onRetry={() => artist.refetch()} />
      </Screen>
    );
  }

  const a = artist.data;
  const albums = a.albums.filter((r) => r.releaseType === "album").length;
  return (
    <Screen back pageTitle={a.name} width="wide">
      <MusicHero
        imageUri={photo.data ?? undefined}
        releaseMbId={photo.data ? undefined : a.albums[0]?.mbid}
        round={!!photo.data}
        title={a.name}
        lines={[[countLabel(a.playCount, "listen") + " on teal", albums ? countLabel(albums, "album") : ""].filter(Boolean).join(" · ")]}
      />

      <Section title="Top listeners" panel>
        <Choices
          label="Period"
          value={period}
          onChange={(next) => void navigate({ search: (prev) => ({ ...prev, period: next }), replace: true, resetScroll: false })}
          options={LISTENER_PERIODS}
        />
        {listeners.isLoading ? (
          <Loading className="py-8" />
        ) : listeners.isError ? (
          <ErrorNotice title="Listeners didn't load" onRetry={() => listeners.refetch()} className="mt-3" />
        ) : !listeners.data?.length ? (
          <p className="py-4 text-ink-2">No listeners in this period yet.</p>
        ) : (
          <>
            <Leaderboard listeners={listeners.data} />
            <LinkButton href={musicArtistListenersHref(a.name, a.mbid, period)} label="See all listeners" icon={Trophy} size="sm" variant="secondary" className="mt-3" />
          </>
        )}
      </Section>

      {discography(a.albums).map((group) => (
        <Section key={group.title} title={group.title} panel>
          <ReleaseGrid releases={group.releases} />
        </Section>
      ))}
    </Screen>
  );
}
