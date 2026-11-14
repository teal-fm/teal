import { createFileRoute, redirect } from "@tanstack/react-router";

/** Album logging moved into Add a listen. */
export const Route = createFileRoute("/manual-listens")({
  beforeLoad: () => {
    throw redirect({ to: "/stamp", search: { mode: "album" }, replace: true });
  },
});
