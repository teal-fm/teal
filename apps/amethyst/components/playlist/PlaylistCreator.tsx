import { useState } from "react";
import { RichText } from "@atproto/api";
import { Button, Field, Glass, Heading, Text } from "@/components/ds";
import { useStore } from "@/stores/mainStore";

/** Start a playlist on your own profile. */
export function PlaylistCreator({ onCreated }: { onCreated: () => void }) {
  const agent = useStore((state) => state.pdsAgent);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!agent?.did || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      let facets: RichText["facets"];
      const text = description.trim();
      if (text) {
        const rich = new RichText({ text });
        await rich.detectFacets(agent);
        facets = rich.facets;
      }
      await agent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: agent.did,
          collection: "fm.teal.feed.social.playlist",
          record: {
            $type: "fm.teal.feed.social.playlist",
            name: name.trim(),
            description: text || undefined,
            descriptionFacets: facets,
            authors: [agent.did],
            createdAt: new Date().toISOString(),
          },
        },
      );
      setName("");
      setDescription("");
      onCreated();
    } catch {
      setError("The playlist wasn't created. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Glass className="gap-3 p-4">
      <Heading level={2} size="card">
        New playlist
      </Heading>
      <Field label="Name" value={name} onChangeText={setName} maxLength={50} />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline maxLength={5000} />
      {error ? (
        <Text role="alert" className="text-[14px] text-destructive">
          {error}
        </Text>
      ) : null}
      <Button label={busy ? "Creating" : "Create playlist"} loading={busy} disabled={!name.trim()} onPress={create} />
    </Glass>
  );
}
