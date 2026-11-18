import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, UserRound } from "lucide-react";

import { useAuth } from "~/lib/auth";
import { displayName, profilePath } from "~/lib/format";
import { Avatar } from "./Avatar";

const menu =
  "absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-neutral-400/20 bg-white/95 p-2 text-left shadow-xl backdrop-blur-xl dark:bg-gray-900/95";
const item =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-teal-500/10";

/** Sign in, or the signed-in person's menu. Hidden when sign-in isn't set up. */
export function Account() {
  const { auth, error, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A failed callback lands back here with an error, so show it.
  useEffect(() => {
    if (error) {
      setOpen(true);
      setBusy(false);
    }
  }, [error]);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (
        event instanceof PointerEvent &&
        root.current?.contains(event.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);

    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (auth.status === "loading" || auth.status === "unavailable") return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await signIn(handle);
    // signIn redirects away on success; anything else is an error to show.
    setBusy(false);
  }

  if (auth.status === "signed-out") {
    return (
      <div ref={root} className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-white/50 px-3.5 py-1.5 text-sm font-medium text-teal-800 backdrop-blur transition hover:bg-teal-500/10 dark:bg-gray-900/50 dark:text-teal-200"
        >
          <LogIn aria-hidden className="size-4" />
          Sign in
        </button>
        {open && (
          <form onSubmit={submit} className={`${menu} p-4`}>
            <label
              htmlFor="sign-in-handle"
              className="mb-1 block text-sm font-medium"
            >
              Your handle
            </label>
            <p className="mb-3 text-xs text-neutral-600 dark:text-teal-100/60">
              Sign in to edit or delete your own listens.
            </p>
            <input
              id="sign-in-handle"
              autoFocus
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="alice.bsky.social"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              className="w-full rounded-full border border-teal-500/30 bg-white/70 px-4 py-2 text-sm outline-none transition placeholder:text-neutral-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 dark:bg-gray-950/60 dark:placeholder:text-teal-100/40"
            />
            {error && (
              <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-3 w-full rounded-full bg-teal-600 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {busy ? "Taking you to your server…" : "Continue"}
            </button>
          </form>
        )}
      </div>
    );
  }

  const { did, profile } = auth;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Account: ${displayName(profile, did)}`}
        onClick={() => setOpen(!open)}
        className="rounded-full ring-teal-500/40 transition hover:ring-4"
      >
        <Avatar profile={profile} size={34} />
      </button>
      {open && (
        <div className={menu}>
          <p className="truncate px-3 pb-2 pt-1 text-sm text-neutral-600 dark:text-teal-100/60">
            Signed in as{" "}
            <span className="font-medium text-neutral-900 dark:text-white">
              {profile?.handle ?? did}
            </span>
          </p>
          <Link
            to="/profile/$handle"
            params={{ handle: profilePath(profile, did) }}
            onClick={() => setOpen(false)}
            className={item}
          >
            <UserRound aria-hidden className="size-4" />
            Your listens
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className={item}
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
