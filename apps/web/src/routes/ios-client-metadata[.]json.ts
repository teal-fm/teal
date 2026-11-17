import { createFileRoute } from "@tanstack/react-router";
import { iosClientMetadataFor } from "~/lib/oauthMetadata";

/** The OAuth client document for the native iOS app (apps/ios); its URL is that app's client_id. */
export const Route = createFileRoute("/ios-client-metadata.json")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = process.env.PUBLIC_ORIGIN || new URL(request.url).origin;

        return Response.json(iosClientMetadataFor(origin), {
          headers: { "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
