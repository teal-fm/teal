import { useQueryClient } from "@tanstack/react-query";
import { Composer } from "@/components/compose/Composer";
import { Glass, goBack, Screen } from "@/components/ds";

/** Post a song: choose what you're hearing and say something about it. Opens as a sheet on phones. */
export default function Compose() {
  const client = useQueryClient();
  return (
    <Screen title="Post a song" back>
      <Glass strong className="p-4">
        <Composer
          chooseTrack
          onPublished={() => {
            void client.invalidateQueries({ queryKey: ["feed"] });
            goBack();
          }}
        />
      </Glass>
    </Screen>
  );
}
