import { createFileRoute } from "@tanstack/react-router";
import { Button, ButtonRow, Dialog, useGo, useGoBack } from "~/ds";
import { signOut } from "~/lib/auth";

export const Route = createFileRoute("/auth/logout")({
  head: () => ({ meta: [{ title: "Sign out · Teal" }] }),
  component: SignOut,
});

function SignOut() {
  const back = useGoBack();
  const go = useGo();
  return (
    <Dialog
      title="Sign out of Teal?"
      description="Your profile and listening history stay with your account. You can sign in again whenever you like."
      onClose={back}
    >
      <ButtonRow>
        <Button
          label="Sign out"
          onClick={() => {
            void signOut();
            void go("/", { replace: true });
          }}
        />
        <Button label="Cancel" variant="secondary" onClick={back} />
      </ButtonRow>
    </Dialog>
  );
}
