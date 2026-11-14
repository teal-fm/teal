import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useViewerDid } from "@teal/client/teal/queries";
import { Choices, LinkButton, Loading, Notice, Screen } from "~/ds";
import { AlbumLog } from "~/components/log/AlbumLog";
import { SongLog } from "~/components/log/SongLog";
import { useAuth } from "~/lib/auth";

export const Route = createFileRoute("/stamp")({
  validateSearch: (search: Record<string, unknown>): { mode?: "album" } => ({ mode: search.mode === "album" ? "album" : undefined }),
  head: () => ({ meta: [{ title: "Add a listen · Teal" }] }),
  component: AddListen,
});

/** Add listens by hand: one song you just heard, or an album (or part of one). */
function AddListen() {
  const viewer = useViewerDid();
  const status = useAuth((state) => state.status);
  const navigate = useNavigate({ from: Route.fullPath });
  const mode = Route.useSearch().mode === "album" ? "album" : "song";
  if (!viewer) {
    return (
      <Screen back title="Add a listen">
        {status === "start" ? (
          <Loading />
        ) : (
          <Notice
            title="Sign in to add listens"
            body="Listens you add are saved to your Atmosphere account."
            action={<LinkButton href="/auth/login" label="Sign in" size="sm" />}
          />
        )}
      </Screen>
    );
  }
  return (
    <Screen back title="Add a listen">
      <Choices
        label="What did you listen to?"
        size="md"
        value={mode}
        onChange={(next) => void navigate({ search: { mode: next === "album" ? "album" : undefined }, replace: true, resetScroll: false })}
        options={[
          { value: "song", label: "A song" },
          { value: "album", label: "An album" },
        ]}
      />
      {mode === "album" ? <AlbumLog /> : <SongLog />}
    </Screen>
  );
}
