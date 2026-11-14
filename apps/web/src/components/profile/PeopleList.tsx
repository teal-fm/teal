import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { usePeople } from "@teal/client/hooks/useProfile";
import { actorAvatarUrl, actorProfileHref, displayActorName, normalizeHandle } from "@teal/client/teal/actors";
import { Avatar, Button, ErrorNotice, Glass, Heading, IconButton, Loading, Row } from "~/ds";

/** Followers or following, opened from the counts in the profile header. */
export function PeopleList({ did, kind, onClose }: { did: string; kind: "followers" | "following"; onClose: () => void }) {
  const people = usePeople(did, kind);
  const actors = people.data?.pages.flatMap((p) => p.actors) ?? [];
  const title = kind === "followers" ? "Followers" : "Following";
  // Keyboard users land in the list they opened, and Escape closes it.
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, [kind]);
  return (
    <Glass
      as="section"
      aria-label={title}
      className="p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <Heading level={2}>{title}</Heading>
        <IconButton ref={closeRef} icon={X} label={`Close ${title.toLowerCase()}`} size={34} onClick={onClose} />
      </div>
      {people.isLoading ? (
        <Loading className="py-8" />
      ) : people.isError ? (
        <ErrorNotice title="This list didn't load" onRetry={() => people.refetch()} />
      ) : actors.length === 0 ? (
        <p className="py-2 text-ink-2">{kind === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
      ) : (
        actors.map((actor, i) => (
          <Row
            key={actor.did ?? i}
            href={`/profile/${actorProfileHref(actor, actor.did)}`}
            leading={<Avatar did={actor.did} avatar={actorAvatarUrl(actor, actor.did)} name={displayActorName(actor, actor.did)} size={40} />}
            title={displayActorName(actor, actor.did)}
            subtitle={actor.handle ? `@${normalizeHandle(actor.handle)}` : undefined}
            divider={i < actors.length - 1}
          />
        ))
      )}
      {people.hasNextPage ? (
        <Button
          label={people.isFetchingNextPage ? "Loading" : "Show more"}
          variant="secondary"
          size="sm"
          className="mt-3"
          loading={people.isFetchingNextPage}
          onClick={() => people.fetchNextPage()}
        />
      ) : null}
    </Glass>
  );
}
