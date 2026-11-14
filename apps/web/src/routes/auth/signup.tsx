import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, AtSign } from "lucide-react";
import { Button, ButtonRow, Glass, Heading, Icon, LinkButton } from "~/ds";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({ meta: [{ title: "Create an account · Teal" }] }),
  component: SignUp,
});

const SIGNUP_URL = "https://bsky.app/signup";

/** Teal uses an Atmosphere account, so creating one happens at Bluesky. */
function SignUp() {
  const [opened, setOpened] = useState(false);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Glass className="flex w-full max-w-md flex-col gap-3 p-7">
        <span className="flex size-12 items-center justify-center rounded-full bg-tint">
          <Icon icon={AtSign} size={24} className="text-on-tint" />
        </span>
        <Heading level={1} size="title">
          Create your account
        </Heading>
        <p className="text-[15px] text-ink-2">
          Teal uses the same account as Bluesky and other Atmosphere apps. Create one with Bluesky, then sign in here with its handle.
        </p>
        <ButtonRow>
          <Button
            label="Continue to Bluesky"
            icon={ArrowUpRight}
            onClick={() => {
              window.open(SIGNUP_URL, "_blank", "noopener,noreferrer");
              setOpened(true);
            }}
          />
          <LinkButton href="/auth/login" label={opened ? "Sign in with my new account" : "I already have an account"} variant="secondary" />
        </ButtonRow>
        {opened ? (
          <p aria-live="polite" className="text-[14px] text-ink-2">
            Once your account is ready, come back and sign in with your new handle.
          </p>
        ) : null}
      </Glass>
    </div>
  );
}
