import { createFileRoute } from "@tanstack/react-router";

import { Header } from "~/components/Header";

/** Where a PDS sends people back after sign-in; AuthProvider finishes the job. */
export const Route = createFileRoute("/oauth/callback")({
  component: Callback,
});

function Callback() {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[60dvh] max-w-md items-center justify-center px-4 text-center">
        <p role="status" className="text-neutral-600 dark:text-teal-100/70">
          Signing you in…
        </p>
      </main>
    </>
  );
}
