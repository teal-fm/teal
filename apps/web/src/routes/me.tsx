import { createFileRoute, Navigate } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { ButtonRow, LinkButton, Loading, Notice, Screen } from "~/ds";
import { useAuth } from "~/lib/auth";

export const Route = createFileRoute("/me")({
  head: () => ({ meta: [{ title: "You · Teal" }] }),
  component: Me,
});

/** You: your own profile when signed in, a way in when not. */
function Me() {
  const status = useAuth((state) => state.status);
  const did = useAuth((state) => state.agent?.did);
  if (status === "loggedIn" && did) return <Navigate to="/profile/$handle" params={{ handle: did }} replace />;
  return (
    <Screen title="You">
      {status === "start" ? (
        <Loading />
      ) : (
        <Notice
          center
          icon={UserRound}
          title="Your listening, yours"
          body="Sign in with your Atmosphere account to see your profile, favourites, and month in covers."
          action={
            // Phones have no sidebar, so Settings (and the theme) is reachable from here too.
            <ButtonRow className="justify-center">
              <LinkButton href="/auth/login" label="Sign in" />
              <LinkButton href="/settings" label="Settings" variant="secondary" />
            </ButtonRow>
          }
        />
      )}
    </Screen>
  );
}
