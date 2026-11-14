import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { firstLoginHref } from "@teal/client/atp/firstLogin";
import { Glass, Heading, LinkButton, Loading, useGo } from "~/ds";
import { startAuth, useAuth } from "~/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  // The OAuth client reads the code from the browser's URL; nothing to render on the server.
  ssr: false,
  head: () => ({ meta: [{ title: "Finishing sign-in · Teal" }] }),
  component: AuthCallback,
});

/** Where the account provider sends people back after approving sign-in. */
function AuthCallback() {
  const go = useGo();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void startAuth().then(async () => {
      const { status, agent } = useAuth.getState();
      if (cancelled) return;
      if (status !== "loggedIn" || !agent?.did) {
        setFailed(true);
        return;
      }
      const did = agent.did;
      const destination = await firstLoginHref(did, () =>
        agent.call("com.atproto.repo.getRecord", { repo: did, collection: "fm.teal.actor.profile", rkey: "self" }),
      );
      if (!cancelled && useAuth.getState().agent?.did === did) void go(destination, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [go]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Glass className="flex w-full max-w-md flex-col items-center gap-3 p-7 text-center">
        {failed ? null : <Loading className="py-2" label="Finishing sign-in" />}
        <Heading level={1} size="title" role={failed ? "alert" : undefined}>
          {failed ? "Couldn't finish signing in" : "Finishing sign-in"}
        </Heading>
        <p className="text-[15px] text-ink-2">
          {failed
            ? "Your sign-in session may have expired. Start again to connect your account."
            : "Connecting your account to Teal. This takes a few seconds."}
        </p>
        {failed ? <LinkButton href="/auth/login" label="Sign in again" className="mt-2 self-center" /> : null}
      </Glass>
    </div>
  );
}
