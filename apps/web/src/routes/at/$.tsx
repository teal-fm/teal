import { createFileRoute, redirect } from "@tanstack/react-router";
import { hrefFromAtUri } from "@teal/client/teal/routes";
import { LinkButton, Notice, Screen } from "~/ds";

/**
 * Opens an at:// link (a listen, post, playlist, or profile) at its teal page.
 * The router rewrites the public `/at://…` path to this internal `/at/…` route.
 */
export const Route = createFileRoute("/at/$")({
  beforeLoad: ({ params }) => {
    const rest = (params._splat ?? "").replace(/^\/+/, "");
    const href = rest ? hrefFromAtUri(`at://${decodeURIComponent(rest)}`) : undefined;
    if (href) throw redirect({ href, replace: true });
  },
  head: () => ({ meta: [{ title: "Unsupported link · Teal" }] }),
  component: () => (
    <Screen back pageTitle="Unsupported link">
      <Notice title="Teal can't open this link" body="It points to a record teal doesn't show yet." action={<LinkButton href="/" label="Go to Today" size="sm" />} />
    </Screen>
  ),
});
