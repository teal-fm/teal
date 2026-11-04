import { Link, router, useLocalSearchParams } from "expo-router";
import { useViewerDid } from "@/lib/teal/queries";
import { Button, Choices, Notice, Screen } from "@/components/ds";
import { AlbumLog } from "@/components/log/AlbumLog";
import { SongLog } from "@/components/log/SongLog";

/** Add listens by hand: one song you just heard, or an album (or part of one). */
export default function AddListen() {
  const viewer = useViewerDid();
  const mode = useLocalSearchParams().mode === "album" ? "album" : "song";
  if (!viewer) {
    return (
      <Screen back title="Add a listen">
        <Notice
          title="Sign in to add listens"
          body="Listens you add are saved to your Atmosphere account."
          action={
            <Link href="/auth/login" asChild>
              <Button label="Sign in" size="sm" />
            </Link>
          }
        />
      </Screen>
    );
  }
  return (
    <Screen back title="Add a listen">
      <Choices
        label="What did you listen to?"
        size="md"
        value={mode}
        onChange={(next) => router.setParams({ mode: next })}
        options={[
          { value: "song", label: "A song" },
          { value: "album", label: "An album" },
        ]}
      />
      {mode === "album" ? <AlbumLog /> : <SongLog />}
    </Screen>
  );
}
