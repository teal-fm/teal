import { createFileRoute } from "@tanstack/react-router";

import { Card } from "~/components/Card";
import { Header } from "~/components/Header";
import { PlayList } from "~/components/PlayList";
import { getPlays } from "~/lib/api";

export const Route = createFileRoute("/listens")({
  loader: () => getPlays({ data: {} }),
  head: () => ({ meta: [{ title: "Everyone's listens · teal.fm" }] }),
  component: Listens,
});

function Listens() {
  const plays = Route.useLoaderData();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display mb-6 text-4xl font-medium">
          Everyone's listens
        </h1>
        <Card title="Latest">
          <PlayList initial={plays} showPeople />
        </Card>
      </main>
    </>
  );
}
