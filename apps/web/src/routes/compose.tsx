import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { rememberPost } from "@teal/client/teal/queries";
import { Glass, Screen, useGoBack } from "~/ds";
import { Composer } from "~/components/compose/Composer";

export const Route = createFileRoute("/compose")({
  head: () => ({ meta: [{ title: "Post a song · Teal" }] }),
  component: Compose,
});

/** Post a song: choose what you're hearing and say something about it. */
function Compose() {
  const client = useQueryClient();
  const back = useGoBack();
  return (
    <Screen title="Post a song" back>
      <Glass strong className="p-4">
        <Composer
          chooseTrack
          onPublished={(post) => {
            rememberPost(client, post.authorDid, post);
            back();
          }}
        />
      </Glass>
    </Screen>
  );
}
