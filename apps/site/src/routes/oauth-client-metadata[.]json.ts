import { createFileRoute } from "@tanstack/react-router";

import { clientMetadata } from "~/lib/oauth";

export const Route = createFileRoute("/oauth-client-metadata.json")({
  server: {
    handlers: {
      GET: ({ request }) =>
        Response.json(clientMetadata(new URL(request.url).origin), {
          headers: { "Cache-Control": "public, max-age=600" },
        }),
    },
  },
});
