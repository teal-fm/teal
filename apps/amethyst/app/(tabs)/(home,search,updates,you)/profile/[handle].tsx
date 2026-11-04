import { useState } from "react";
import { View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeHandle } from "@/lib/teal/actors";
import { useViewerDid } from "@/lib/teal/queries";
import { playlistHref } from "@/lib/teal/routes";
import { normalizePeriod } from "@/lib/teal/topStats";
import {
  Button,
  ErrorNotice,
  Loading,
  Notice,
  Row,
  Screen,
  Section,
  Tabs,
  useLayout,
} from "@/components/ds";
import { CoverCalendar } from "@/components/profile/CoverCalendar";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { Favourites } from "@/components/profile/Favourites";
import { ListeningHistory, usePlaysWithPending } from "@/components/profile/ListeningHistory";
import { NowAndRecent } from "@/components/profile/NowAndRecent";
import { PeopleList } from "@/components/profile/PeopleList";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { TasteMatch } from "@/components/profile/TasteMatch";
import { TopStats } from "@/components/profile/TopStats";
import { PlaylistCreator } from "@/components/playlist/PlaylistCreator";
import { PostCard } from "@/components/today/PostCard";
import {
  useActorDid,
  useActorPlaylists,
  useActorPosts,
  useGraphSummary,
  ProfileNotFoundError,
  useProfile,
  type DisplayProfile,
} from "@/hooks/useProfile";

type Tab = "overview" | "listening" | "posts" | "playlists";
const TABS = ["overview", "listening", "posts", "playlists"] as const;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ProfileScreen() {
  const params = useLocalSearchParams();
  const actor = param(params.handle);
  const tab: Tab = TABS.includes(param(params.tab) as Tab) ? (param(params.tab) as Tab) : "overview";
  const viewer = useViewerDid();
  const layout = useLayout();
  const didQuery = useActorDid(actor);
  const did = didQuery.data;
  const profileQuery = useProfile(did, actor && !actor.startsWith("did:") ? actor : undefined);
  const graph = useGraphSummary(did);
  const [people, setPeople] = useState<"followers" | "following" | null>(null);
  const [editing, setEditing] = useState(false);

  const profile = profileQuery.data?.profile;
  const name = profile?.displayName || normalizeHandle(profile?.handle) || "Listener";
  const isSelf = !!viewer && did === viewer;
  const failed = didQuery.isError || profileQuery.isError;

  if (didQuery.isLoading || (did && profileQuery.isLoading)) {
    return (
      <Screen back pageTitle="Profile">
        <Loading />
      </Screen>
    );
  }
  if (failed || !did) {
    return (
      <Screen back pageTitle="Profile">
        <ErrorNotice
          title={didQuery.isError || !did || profileQuery.error instanceof ProfileNotFoundError ? "This profile could not be found" : "This profile didn't load"}
          body="Check the handle or try again in a moment."
          onRetry={() => (didQuery.isError ? didQuery.refetch() : profileQuery.refetch())}
        />
        <Link href="/search" asChild>
          <Button label="Find a listener" variant="secondary" />
        </Link>
      </Screen>
    );
  }

  const extras = (
    <>
      {viewer && !isSelf ? (
        <TasteMatch
          actor={did}
          viewer={viewer}
          name={name}
          avatars={{ viewer: { did: viewer }, actor: { did, avatar: profile?.avatar } }}
        />
      ) : null}
      <CoverCalendar actor={did} name={isSelf ? "you" : name} />
    </>
  );

  return (
    <Screen back={!isSelf} pageTitle={name} rail={<View className="gap-3">{extras}</View>}>
      <ProfileHeader
        did={did}
        profile={profile}
        graph={graph.data}
        isSelf={isSelf}
        listeningNow={!!profile?.status?.item}
        people={people}
        onPeople={(kind) => setPeople((open) => (open === kind ? null : kind))}
        onEdit={() => setEditing(true)}
      />
      {people ? <PeopleList did={did} kind={people} onClose={() => setPeople(null)} /> : null}

      <Tabs
        label="Profile sections"
        value={tab}
        onChange={(next) => router.setParams({ tab: next })}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "listening", label: "Listening" },
          { value: "posts", label: "Posts" },
          { value: "playlists", label: "Playlists" },
        ]}
      />
      <View role="tabpanel" aria-label={tab} className="gap-4">
        {tab === "overview" ? (
          <Overview did={did} profile={profile} isSelf={isSelf} fromBluesky={!!profileQuery.data?.fromBluesky} onEdit={() => setEditing(true)} extras={layout.rail ? null : extras} />
        ) : tab === "listening" ? (
          <ListeningHistory did={did} isSelf={isSelf} />
        ) : tab === "posts" ? (
          <Posts did={did} isSelf={isSelf} />
        ) : (
          <Playlists did={did} isSelf={isSelf} />
        )}
      </View>

      {isSelf ? <EditProfileSheet did={did} profile={profile} visible={editing} onClose={() => setEditing(false)} /> : null}
    </Screen>
  );
}

function Overview({
  did,
  profile,
  isSelf,
  fromBluesky,
  onEdit,
  extras,
}: {
  did: string;
  profile?: DisplayProfile;
  isSelf: boolean;
  fromBluesky: boolean;
  onEdit: () => void;
  extras: React.ReactNode;
}) {
  const { query, indexed, plays } = usePlaysWithPending(did, isSelf);
  const posts = useActorPosts(did);
  const playlists = useActorPlaylists(did);
  const layout = useLayout();
  const latest = posts.data?.pages[0]?.items[0];
  const firstPlaylist = playlists.data?.pages[0]?.items[0];

  return (
    <>
      {isSelf && fromBluesky ? (
        <Notice
          title="Make this profile yours"
          body="Your Bluesky details are here to get you started. Add your Teal name, bio, and artwork."
          action={
            <Link href="/onboarding" asChild>
              <Button label="Set up your Teal profile" size="sm" />
            </Link>
          }
        />
      ) : null}
      {query.isError ? (
        <ErrorNotice title="Recent listening didn't load" onRetry={() => query.refetch()} />
      ) : (
        <NowAndRecent now={profile?.status?.item} recent={plays.slice(0, 10)} />
      )}
      <Favourites favourites={profile?.favorites ?? []} isSelf={isSelf} onEdit={onEdit} />
      {extras}
      {plays.length ? (
        <TopStats actor={did} defaultPeriod={normalizePeriod(profile?.statsDefaultPeriod)} plays={indexed} wide={layout.sidebar} />
      ) : null}
      {latest ? (
        <Section title="Latest post" more={{ label: "See all", href: `/profile/${did}?tab=posts` as never }}>
          <PostCard post={latest} />
        </Section>
      ) : null}
      {firstPlaylist ? (
        <Section title="Playlists" panel more={{ label: "See all", href: `/profile/${did}?tab=playlists` as never }}>
          <Row
            href={playlistHref(firstPlaylist.name, firstPlaylist.uri) as never}
            title={firstPlaylist.name}
            subtitle={`${firstPlaylist.itemCount} ${firstPlaylist.itemCount === 1 ? "track" : "tracks"}`}
            divider={false}
          />
        </Section>
      ) : null}
    </>
  );
}

function Posts({ did, isSelf }: { did: string; isSelf: boolean }) {
  const posts = useActorPosts(did);
  const items = posts.data?.pages.flatMap((p) => p.items) ?? [];
  if (posts.isLoading) return <Loading />;
  if (posts.isError) return <ErrorNotice title="Posts didn't load" onRetry={() => posts.refetch()} />;
  if (!items.length) {
    return (
      <Notice
        title="No posts yet"
        body={isSelf ? "Post a song and what you think of it; it shows up here." : "Nothing posted yet."}
        action={
          isSelf ? (
            <Link href="/compose" asChild>
              <Button label="Post a song" size="sm" />
            </Link>
          ) : null
        }
      />
    );
  }
  return (
    <View>
      {items.map((post) => (
        <PostCard key={post.uri} post={post} />
      ))}
      {posts.hasNextPage ? (
        <Button
          label={posts.isFetchingNextPage ? "Loading" : "Load more"}
          variant="secondary"
          className="self-center"
          loading={posts.isFetchingNextPage}
          onPress={() => posts.fetchNextPage()}
        />
      ) : null}
    </View>
  );
}

function Playlists({ did, isSelf }: { did: string; isSelf: boolean }) {
  const playlists = useActorPlaylists(did);
  const client = useQueryClient();
  const items = playlists.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View className="gap-4">
      {isSelf ? <PlaylistCreator onCreated={() => client.invalidateQueries({ queryKey: ["actor-playlists", did] })} /> : null}
      {playlists.isLoading ? (
        <Loading />
      ) : playlists.isError ? (
        <ErrorNotice title="Playlists didn't load" onRetry={() => playlists.refetch()} />
      ) : !items.length ? (
        <Notice title="No playlists yet" body={isSelf ? "Make one above, then add songs from any song page." : "Nothing here yet."} />
      ) : (
        <Section title="Playlists" panel>
          {items.map((playlist, i) => (
            <Row
              key={playlist.uri}
              href={playlistHref(playlist.name, playlist.uri) as never}
              title={playlist.name}
              subtitle={`${playlist.itemCount} ${playlist.itemCount === 1 ? "track" : "tracks"}`}
              divider={i < items.length - 1}
            />
          ))}
        </Section>
      )}
      {playlists.hasNextPage ? (
        <Button label="Load more" variant="secondary" className="self-center" onPress={() => playlists.fetchNextPage()} />
      ) : null}
    </View>
  );
}
