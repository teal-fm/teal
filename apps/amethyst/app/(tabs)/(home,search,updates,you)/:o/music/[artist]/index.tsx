import { useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react-native";
import { getArtist, getArtistImageUrl, getArtistListeners } from "@/lib/teal/api";
import { countLabel, discography, LISTENER_PERIODS, normalizeListenerPeriod } from "@/lib/teal/music";
import { musicArtistListenersHref } from "@/lib/teal/routes";
import { Button, Choices, ErrorNotice, Loading, Screen, Section, Text } from "@/components/ds";
import { Leaderboard } from "@/components/music/Leaderboard";
import { MusicHero } from "@/components/music/MusicHero";
import { ReleaseGrid } from "@/components/music/ReleaseGrid";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** An artist: who they are on teal, who listens most, and their releases. */
export default function ArtistScreen() {
  const params = useLocalSearchParams();
  const mbid = param(params.mbid);
  const lookup = param(params.name) || param(params.artist);
  const [period, setPeriod] = useState(normalizeListenerPeriod(param(params.period)));

  const artist = useQuery({
    queryKey: ["artist", mbid, lookup],
    queryFn: () => getArtist(mbid, lookup).then((r) => r.artist),
  });
  const photo = useQuery({
    queryKey: ["artist-image", artist.data?.mbid],
    queryFn: () => getArtistImageUrl(artist.data!.mbid, 500),
    enabled: !!artist.data?.mbid,
    staleTime: Infinity,
  });
  const listeners = useQuery({
    queryKey: ["artist-listeners", mbid, lookup, period, 5],
    queryFn: () => getArtistListeners(mbid, lookup, period, 5).then((r) => r.listeners),
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
        imageUri={photo.data}
        releaseMbId={photo.data ? undefined : a.albums[0]?.mbid}
        round={!!photo.data}
        title={a.name}
        lines={[[countLabel(a.playCount, "listen") + " on teal", albums ? countLabel(albums, "album") : ""].filter(Boolean).join(" · ")]}
      />

      <Section title="Top listeners" panel>
        <Choices label="Period" value={period} onChange={setPeriod} options={LISTENER_PERIODS} />
        {listeners.isLoading ? (
          <Loading className="py-8" />
        ) : listeners.isError ? (
          <ErrorNotice title="Listeners didn't load" onRetry={() => listeners.refetch()} className="mt-3" />
        ) : !listeners.data?.length ? (
          <Text className="py-4 text-ink-2">No listeners in this period yet.</Text>
        ) : (
          <>
            <Leaderboard listeners={listeners.data} />
            <Link href={musicArtistListenersHref(a.name, a.mbid, period) as never} asChild>
              <Button label="See all listeners" icon={Trophy} size="sm" variant="secondary" className="mt-3" />
            </Link>
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
