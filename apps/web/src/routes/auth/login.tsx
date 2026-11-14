import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronRight, CircleAlert } from "lucide-react";
import { resolveFromIdentity } from "@teal/client/atp/pid";
import { normalizeAuthHandle } from "@teal/client/authHandle";
import { A, Button, Dialog, Field, Icon, Spinner, useGoBack } from "~/ds";
import { signIn } from "~/lib/auth";

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Sign in · Teal" }] }),
  component: Login,
});

const RESOLVE_DELAY = 500;

/** "morel.us-east.host.bsky.network" reads as "Bluesky (Morel)". */
function providerName(pds: URL) {
  if (!pds.hostname.endsWith("bsky.network")) return pds.hostname;
  const shroom = pds.hostname.split(".")[0] ?? "";
  return `Bluesky (${shroom.charAt(0).toUpperCase()}${shroom.slice(1)})`;
}

type Lookup = { state: "idle" } | { state: "resolving" } | { state: "found"; pds: URL } | { state: "missing" };

/** Sign in with an Atmosphere handle: find the account's provider, then hand off to OAuth. */
function Login() {
  const close = useGoBack();
  const [handle, setHandle] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const resolve = async (value: string) => {
    const current = ++version.current;
    setLookup({ state: "resolving" });
    try {
      const identity = await resolveFromIdentity(value);
      if (current !== version.current) return;
      setLookup(identity?.pds ? { state: "found", pds: identity.pds } : { state: "missing" });
    } catch {
      if (current === version.current) setLookup({ state: "missing" });
    }
  };

  const onChange = (text: string) => {
    setHandle(text);
    setError(null);
    version.current += 1;
    if (timer.current) clearTimeout(timer.current);
    const value = normalizeAuthHandle(text);
    if (value.length > 3) {
      setLookup({ state: "resolving" });
      timer.current = setTimeout(() => void resolve(value), RESOLVE_DELAY);
    } else {
      setLookup({ state: "idle" });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = normalizeAuthHandle(handle);
    if (busy || lookup.state !== "found" || !value) return;
    setBusy(true);
    setError(null);
    try {
      // Navigates away to the account provider; returning means it didn't start.
      await signIn(value);
    } catch {
      setError("Sign-in didn't start. Check your handle and try again.");
    }
    setBusy(false);
  };

  return (
    <Dialog
      title="Sign in to Teal"
      description="Use your Bluesky or other Atmosphere account. We'll send you to your account provider to approve sign-in."
      onClose={close}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Handle"
          value={handle}
          onChange={(event) => onChange(event.target.value)}
          placeholder="alice.bsky.social or did:plc:…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          inputMode="email"
          enterKeyHint="go"
          autoFocus
        />
        <div aria-live="polite" className="flex min-h-6 items-center gap-2 text-[14px]">
          {lookup.state === "resolving" ? (
            <>
              <Spinner className="size-4" />
              <span className="text-ink-2">Finding your account…</span>
            </>
          ) : lookup.state === "found" ? (
            <>
              <Icon icon={Check} size={16} className="text-tint" />
              <span className="min-w-0 flex-1 truncate text-ink-2">Account provider: {providerName(lookup.pds)}</span>
            </>
          ) : lookup.state === "missing" ? (
            <>
              <Icon icon={CircleAlert} size={16} className="text-destructive" />
              <span role="alert" className="flex-1 text-destructive">
                Couldn't find this account. Check your handle and try again.
              </span>
            </>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-[14px] text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <A href="/auth/signup" className="flex min-h-11 items-center text-[15px] font-semibold text-tint hover:underline">
            Create an account
          </A>
          <Button
            type="submit"
            label={busy ? "Redirecting" : "Sign in"}
            icon={busy ? undefined : ChevronRight}
            loading={busy}
            disabled={lookup.state !== "found"}
          />
        </div>
      </form>
    </Dialog>
  );
}
