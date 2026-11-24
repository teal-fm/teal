import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import { Link, router, useLocalSearchParams, usePathname } from "expo-router";
import { firstLoginHref } from "@teal/client/atp/firstLogin";
import { isCompleteOAuthResponse } from "@teal/client/atp/latestOAuthCallback";
import { Button, Glass, Heading, Loading, PageTitle, Text } from "@/components/ds";
import { useStore } from "@/stores/mainStore";
import { appHref } from "@/lib/href";

function toSearchParams(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      search.append(key, item);
    }
  }

  return search;
}

/** Where the account provider sends people back after approving sign-in. */
export default function AuthCallback() {
  const params = useLocalSearchParams();
  const pathname = usePathname();
  const activePath = useRef(pathname);
  activePath.current = pathname;

  const hydrated = useSyncExternalStore(
    useStore.persist.onFinishHydration,
    useStore.persist.hasHydrated,
    () => false,
  );

  const response = toSearchParams(params);
  const query = response.toString();
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const failed = response.has("error") || failedQuery === query;

  useEffect(() => {
    const callback = new URLSearchParams(query);

    if (!hydrated || !isCompleteOAuthResponse(callback)) return;
    let active = true;
    const stillHere = () => active && activePath.current === "/auth/callback";
    useStore
      .getState()
      .oauthCallback(callback)
      .then(async () => {
        // The store reports failures in state rather than rejecting.
        const { status, pdsAgent } = useStore.getState();

        if (!stillHere()) return;

        if (status !== "loggedIn" || !pdsAgent?.did) {
          setFailedQuery(query);

          return;
        }

        const did = pdsAgent.did;

        const destination = await firstLoginHref(did, () =>
          pdsAgent.call("com.atproto.repo.getRecord", {
            repo: did,
            collection: "fm.teal.actor.profile",
            rkey: "self",
          }),
        );

        const current = useStore.getState();

        if (stillHere() && current.status === "loggedIn" && current.pdsAgent?.did === did) {
          router.replace(appHref(destination));
        }
      })
      .catch(() => {
        if (stillHere()) setFailedQuery(query);
      });

    return () => { active = false; };
  }, [hydrated, query]);

  return (
    <View className="flex-1 items-center justify-center bg-ground px-4">
      <PageTitle title={failed ? "Sign-in failed" : "Finishing sign-in"} />
      <Glass className="w-full max-w-md items-center gap-3 p-7">
        {failed ? null : <Loading className="py-2" label="Finishing sign-in" />}
        <Heading level={1} size="title" className="text-center" role={failed ? "alert" : "heading"}>
          {failed ? "Couldn't finish signing in" : "Finishing sign-in"}
        </Heading>
        <Text className="text-center text-[15px] text-ink-2">
          {failed
            ? "Your sign-in session may have expired. Start again to connect your account."
            : "Connecting your account to Teal. This takes a few seconds."}
        </Text>
        {failed || (hydrated && !isCompleteOAuthResponse(response)) ? (
          <Link href="/auth/login" asChild>
            <Button label="Sign in again" className="mt-2 self-center" />
          </Link>
        ) : null}
      </Glass>
    </View>
  );
}
