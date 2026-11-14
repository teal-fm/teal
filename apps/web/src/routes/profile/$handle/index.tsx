import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  actorDidQuery,
  ProfileNotFoundError,
  profileQuery,
  useActorDid,
  useActorPlaylists,
  useActorPosts,
  useGraphSummary,
  useProfile,
  type DisplayProfile,
} from "@teal/client/hooks/useProfile";
import { getProfileImageUrl, normalizeHandle } from "@teal/client/teal/actors";
import { useViewerDid } from "@teal/client/teal/queries";
import { playlistHref } from "@teal/client/teal/routes";
import { normalizePeriod } from "@teal/client/teal/topStats";
import { Button, ErrorNotice, LinkButton, Loading, Notice, Row, Screen, Section, Tabs } from "~/ds";
import { PlaylistCreator } from "~/components/playlist/PlaylistCreator";
import { CoverCalendar } from "~/components/profile/CoverCalendar";
import { EditProfileSheet } from "~/components/profile/EditProfileSheet";
import { Favourites } from "~/components/profile/Favourites";
import { ListeningHistory, usePlaysWithPending } from "~/components/profile/ListeningHistory";
import { NowAndRecent } from "~/components/profile/NowAndRecent";
import { PeopleList } from "~/components/profile/PeopleList";
import { ProfileHeader } from "~/components/profile/ProfileHeader";
import { TasteMatch } from "~/components/profile/TasteMatch";
import { TopStats } from "~/components/profile/TopStats";
import { PostCard } from "~/components/today/PostCard";
import { useLayout } from "~/lib/media";
import { once, pageMeta, serverAwait } from "~/lib/meta";

const TABS = ["overview", "listening", "posts", "playlists"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/profile/$handle/")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => ({
    tab: TABS.includes(search.tab as Tab) ? (search.tab as Tab) : undefined,
  }),
  loader: ({ params, context: { queryClient } }) =>
    serverAwait(async () => {
      const did = await queryClient.ensureQueryData(once(actorDidQuery(params.handle)));
      const hint = params.handle.startsWith("did:") ? undefined : params.handle;
      const { profile } = await queryClient.ensureQueryData(once(profileQuery(did, hint)));
      const handle = normalizeHandle(profile.handle);
      return {
        title: profile.displayName || (handle ? `@${handle}` : did),
        description: profile.description || (handle ? `@${handle} on Teal` : undefined),
        image: getProfileImageUrl(did, profile.avatar, "avatar"),
      };
    }),
  head: ({ loaderData }) => ({ meta: loaderData ? pageMeta(loaderData) : [{ title: "Profile · Teal" }] }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const { handle: actor } = Route.useParams();
  const tab = Route.useSearch().tab ?? "overview";
  const navigate = useNavigate({ from: Route.fullPath });
  const viewer = useViewerDid();
  const layout = useLayout();
  const didQuery = useActorDid(actor);
  const did = didQuery.data;
  const profileResult = useProfile(did, actor && !actor.startsWith("did:") ? actor : undefined);
  const graph = useGraphSummary(did);
  const [people, setPeople] = useState<"followers" | "following" | null>(null);
  const [editing, setEditing] = useState(false);

  const profile = profileResult.data?.profile;
  const name = profile?.displayName || normalizeHandle(profile?.handle) || did || actor || "";
  const isSelf = !!viewer && did === viewer;
  const failed = didQuery.isError || profileResult.isError;

  if (didQuery.isLoading || (did && profileResult.isLoading)) {
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
          title={
            didQuery.isError || !did || profileResult.error instanceof ProfileNotFoundError ? "This profile could not be found" : "This profile didn't load"
          }
          body="Check the handle or try again in a moment."
          onRetry={() => (didQuery.isError ? didQuery.refetch() : profileResult.refetch())}
        />
        <LinkButton href="/search" label="Find a listener" variant="secondary" />
      </Screen>
    );
  }

  const extras = (
    <>
      {viewer && !isSelf ? (
        <TasteMatch actor={did} viewer={viewer} name={name} avatars={{ viewer: { did: viewer }, actor: { did, avatar: profile?.avatar } }} />
      ) : null}
      <CoverCalendar actor={did} name={isSelf ? "you" : name} />
    </>
  );

  return (
    <Screen back={!isSelf} pageTitle={name} rail={extras}>
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
        onChange={(next) => void navigate({ search: { tab: next === "overview" ? undefined : next }, replace: true, resetScroll: false })}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "listening", label: "Listening" },
          { value: "posts", label: "Posts" },
          { value: "playlists", label: "Playlists" },
        ]}
      />
      <div role="tabpanel" aria-label={tab} className="flex flex-col gap-4">
        {tab === "overview" ? (
          <Overview
            did={did}
            profile={profile}
            isSelf={isSelf}
            fromBluesky={!!profileResult.data?.fromBluesky}
            onEdit={() => setEditing(true)}
            extras={layout.rail ? null : extras}
          />
        ) : tab === "listening" ? (
          <ListeningHistory did={did} isSelf={isSelf} />
        ) : tab === "posts" ? (
          <Posts did={did} isSelf={isSelf} />
        ) : (
          <Playlists did={did} isSelf={isSelf} />
        )}
      </div>

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
  extras: ReactNode;
}) {
  const { query, indexed, plays } = usePlaysWithPending(did, isSelf);
  const posts = useActorPosts(did);
  const playlists = useActorPlaylists(did);
  const latest = posts.data?.pages[0]?.items[0];
  const firstPlaylist = playlists.data?.pages[0]?.items[0];

  return (
    <>
      {isSelf && fromBluesky ? (
        <Notice
          title="Make this profile yours"
          body="Your Bluesky details are here to get you started. Add your Teal name, bio, and artwork."
          action={<LinkButton href="/onboarding" label="Set up your Teal profile" size="sm" />}
        />
      ) : null}
      {query.isError ? (
        <ErrorNotice title="Recent listening didn't load" onRetry={() => query.refetch()} />
      ) : (
        <NowAndRecent now={profile?.status?.item} recent={plays.slice(0, 10)} />
      )}
      <Favourites favourites={profile?.favorites ?? []} isSelf={isSelf} onEdit={onEdit} />
      {extras}
      {plays.length ? <TopStats actor={did} defaultPeriod={normalizePeriod(profile?.statsDefaultPeriod)} plays={indexed} /> : null}
      {latest ? (
        <Section title="Latest post" more={{ label: "See all", href: `/profile/${did}?tab=posts` }}>
          <PostCard post={latest} />
        </Section>
      ) : null}
      {firstPlaylist ? (
        <Section title="Playlists" panel more={{ label: "See all", href: `/profile/${did}?tab=playlists` }}>
          <Row
            href={playlistHref(firstPlaylist.name, firstPlaylist.uri)}
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
        action={isSelf ? <LinkButton href="/compose" label="Post a song" size="sm" /> : null}
      />
    );
  }
  return (
    <div className="flex flex-col">
      {items.map((post) => (
        <PostCard key={post.uri} post={post} />
      ))}
      {posts.hasNextPage ? (
        <Button
          label={posts.isFetchingNextPage ? "Loading" : "Load more"}
          variant="secondary"
          className="self-center"
          loading={posts.isFetchingNextPage}
          onClick={() => posts.fetchNextPage()}
        />
      ) : null}
    </div>
  );
}

function Playlists({ did, isSelf }: { did: string; isSelf: boolean }) {
  const playlists = useActorPlaylists(did);
  const client = useQueryClient();
  const items = playlists.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="flex flex-col gap-4">
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
              href={playlistHref(playlist.name, playlist.uri)}
              title={playlist.name}
              subtitle={`${playlist.itemCount} ${playlist.itemCount === 1 ? "track" : "tracks"}`}
              divider={i < items.length - 1}
            />
          ))}
        </Section>
      )}
      {playlists.hasNextPage ? <Button label="Load more" variant="secondary" className="self-center" onClick={() => playlists.fetchNextPage()} /> : null}
    </div>
  );
}
