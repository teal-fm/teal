import { useState, type FormEvent } from "react";
import { RichText } from "@atproto/api";
import { usePdsAgent } from "@teal/client/session";
import { Button, Field, Glass, Heading, TextArea } from "~/ds";

/** Start a playlist on your own profile. */
export function PlaylistCreator({ onCreated }: { onCreated: () => void }) {
  const agent = usePdsAgent();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
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
    <Glass as="section" className="p-4">
      <form onSubmit={create} className="flex flex-col gap-3">
        <Heading level={2} size="card">
          New playlist
        </Heading>
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
        <TextArea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
        {error ? (
          <p role="alert" className="text-[14px] text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" label={busy ? "Creating" : "Create playlist"} loading={busy} disabled={!name.trim()} />
      </form>
    </Glass>
  );
}
