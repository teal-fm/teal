import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import { Link, router } from "expo-router";
import { openAuthSessionAsync } from "expo-web-browser";
import { Check, ChevronRight, CircleAlert } from "lucide-react-native";
import { resolveFromIdentity } from "@/lib/atp/pid";
import { normalizeAuthHandle } from "@/lib/authHandle";
import { Button, Dialog, Field, goBack, Icon, PageTitle, Text } from "@/next/components/ds";
import { useStore } from "@/stores/mainStore";

const RESOLVE_DELAY = 500;

/** "morel.us-east.host.bsky.network" reads as "Bluesky (Morel)". */
function providerName(pds: URL) {
  if (!pds.hostname.endsWith("bsky.network")) return pds.hostname;
  const shroom = pds.hostname.split(".")[0] ?? "";
  return `Bluesky (${shroom.charAt(0).toUpperCase()}${shroom.slice(1)})`;
}

type Lookup =
  | { state: "idle" }
  | { state: "resolving" }
  | { state: "found"; pds: URL }
  | { state: "missing" };

/** Sign in with an Atmosphere handle: find the account's provider, then hand off to OAuth. */
export default function Login() {
  const getLoginUrl = useStore((state) => state.getLoginUrl);
  const oauthCallback = useStore((state) => state.oauthCallback);
  const [handle, setHandle] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"signing-in" | "redirecting" | null>(null);
  const version = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const resolve = useCallback(async (value: string) => {
    const current = ++version.current;
    setLookup({ state: "resolving" });
    try {
      const identity = await resolveFromIdentity(value);
      if (current !== version.current) return;
      setLookup(identity?.pds ? { state: "found", pds: identity.pds } : { state: "missing" });
    } catch {
      if (current === version.current) setLookup({ state: "missing" });
    }
  }, []);

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

  const signIn = async () => {
    const value = normalizeAuthHandle(handle);
    if (busy || lookup.state !== "found" || !value) return;
    setBusy("signing-in");
    setError(null);
    try {
      const url = await getLoginUrl(value);
      if (!url) throw new Error("no login url");
      setBusy("redirecting");
      if (Platform.OS === "web") {
        router.navigate(url.toString() as never);
        return;
      }
      const result = await openAuthSessionAsync(url.toString(), "http://127.0.0.1:8081/login");
      if (result.type === "success") {
        await oauthCallback(new URLSearchParams(result.url.split("?")[1]));
        router.replace("/");
      } else {
        setError(result.type === "cancel" || result.type === "dismiss" ? "Sign-in was cancelled." : "Sign-in didn't finish. Try again.");
        setBusy(null);
      }
    } catch {
      setError("Sign-in didn't start. Check your handle and try again.");
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle title="Sign in" />
      <Dialog
        title="Sign in to Teal"
        description="Use your Bluesky or other Atmosphere account. We'll send you to your account provider to approve sign-in."
        onClose={goBack}
      >
        <Field
          label="Handle"
          value={handle}
          onChangeText={onChange}
          onSubmitEditing={signIn}
          placeholder="alice.bsky.social or did:plc:…"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          inputMode="email"
          returnKeyType="go"
          autoFocus
        />
        <View aria-live="polite" className="min-h-6 flex-row items-center gap-2">
          {lookup.state === "resolving" ? (
            <>
              <ActivityIndicator size="small" />
              <Text className="text-[14px] text-ink-2">Finding your account…</Text>
            </>
          ) : lookup.state === "found" ? (
            <>
              <Icon icon={Check} size={16} className="text-tint" />
              <Text className="min-w-0 flex-1 text-[14px] text-ink-2" numberOfLines={1}>
                Account provider: {providerName(lookup.pds)}
              </Text>
            </>
          ) : lookup.state === "missing" ? (
            <>
              <Icon icon={CircleAlert} size={16} className="text-destructive" />
              <Text role="alert" className="flex-1 text-[14px] text-destructive">
                Couldn't find this account. Check your handle and try again.
              </Text>
            </>
          ) : null}
        </View>
        {error ? (
          <Text role="alert" className="text-[14px] text-destructive">
            {error}
          </Text>
        ) : null}
        <View className="flex-row items-center justify-between gap-3">
          <Link href="/auth/signup" asChild>
            <Pressable accessibilityRole="link" className="min-h-11 justify-center">
              <Text className="text-[15px] font-semibold text-tint">Create an account</Text>
            </Pressable>
          </Link>
          <Button
            label={busy === "redirecting" ? "Redirecting" : busy ? "Signing in" : "Sign in"}
            icon={busy ? undefined : ChevronRight}
            loading={!!busy}
            disabled={lookup.state !== "found"}
            onPress={signIn}
          />
        </View>
      </Dialog>
    </>
  );
}
