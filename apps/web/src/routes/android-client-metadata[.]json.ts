import { createFileRoute } from "@tanstack/react-router";
import { androidClientMetadataFor } from "~/lib/oauthMetadata";

/** The OAuth client document for the Android app (apps/amethyst); its URL is that app's client_id. */
export const Route = createFileRoute("/android-client-metadata.json")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = process.env.PUBLIC_ORIGIN || new URL(request.url).origin;

        return Response.json(androidClientMetadataFor(origin), {
          headers: { "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
