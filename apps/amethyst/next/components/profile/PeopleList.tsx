import { X } from "lucide-react-native";
import { View } from "react-native";
import { actorAvatarUrl, actorProfileHref, displayActorName, normalizeHandle } from "@/lib/teal/actors";
import { Avatar, Button, ErrorNotice, Glass, Heading, IconButton, Loading, Row, Text } from "@/next/components/ds";
import { usePeople } from "@/next/hooks/useProfile";

/** Followers or following, opened from the counts in the profile header. */
export function PeopleList({ did, kind, onClose }: { did: string; kind: "followers" | "following"; onClose: () => void }) {
  const people = usePeople(did, kind);
  const actors = people.data?.pages.flatMap((p) => p.actors) ?? [];
  const title = kind === "followers" ? "Followers" : "Following";
  return (
    <Glass className="p-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Heading level={2}>{title}</Heading>
        <IconButton icon={X} label={`Close ${title.toLowerCase()}`} size={34} onPress={onClose} />
      </View>
      {people.isLoading ? (
        <Loading className="py-8" />
      ) : people.isError ? (
        <ErrorNotice title="This list didn't load" onRetry={() => people.refetch()} />
      ) : actors.length === 0 ? (
        <Text className="py-2 text-ink-2">{kind === "followers" ? "No followers yet." : "Not following anyone yet."}</Text>
      ) : (
        actors.map((actor, i) => (
          <Row
            key={actor.did ?? i}
            href={`/profile/${actorProfileHref(actor, actor.did)}` as never}
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
          onPress={() => people.fetchNextPage()}
        />
      ) : null}
    </Glass>
  );
}
