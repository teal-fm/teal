import { createFileRoute } from "@tanstack/react-router";
import { clientMetadataFor } from "~/lib/oauthMetadata";

/** The OAuth client document; its URL is the client_id the browser client uses. */
export const Route = createFileRoute("/client-metadata.json")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = process.env.PUBLIC_ORIGIN || new URL(request.url).origin;
        return Response.json(clientMetadataFor(origin), {
          headers: { "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
