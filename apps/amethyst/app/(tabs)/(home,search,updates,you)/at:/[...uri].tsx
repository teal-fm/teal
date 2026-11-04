import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Link, Redirect, Stack, useLocalSearchParams } from "expo-router";
import RightRail from "@/components/teal/RightRail";
import TealShell from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { atUriFromRoutePath, hrefFromAtUri } from "@/lib/teal/routes";

function atUriFromParams(param: string | string[] | undefined) {
  if (typeof window !== "undefined") {
    const atUri = atUriFromRoutePath(window.location.pathname);
    if (atUri) return atUri;
  }

  const parts = Array.isArray(param) ? param : param ? [param] : [];
  return parts.length > 0 ? `at://${parts.join("/")}` : undefined;
}

export default function AtUriResolver() {
  const params = useLocalSearchParams();
  const atUri = useMemo(() => atUriFromParams(params.uri), [params.uri]);
  const href = hrefFromAtUri(atUri);

  useEffect(() => {
    if (!href && atUri) {
      console.warn("Unsupported Teal AT-URI route", atUri);
    }
  }, [atUri, href]);

  if (href) {
    return <Redirect href={href as any} />;
  }

  return (
    <TealShell rightRail={<RightRail />} pageTitle="Open link">
      <Stack.Screen options={{ title: "AT URI", headerShown: false }} />
      <View className="rounded-[26px] border border-glass-edge bg-glass-strong web:backdrop-blur-2xl p-5">
        <Text className="mt-2 font-sans text-2xl font-black">
          Unsupported Teal link
        </Text>
        <Text className="mt-2 text-ink-2">
          Teal can open profile, listen, post, and playlist AT-URIs. Check that
          this is the full record link.
        </Text>
        <Link href="/" asChild>
          <Button className="mt-4 self-start">
            <Text>Go home</Text>
          </Button>
        </Link>
      </View>
    </TealShell>
  );
}
