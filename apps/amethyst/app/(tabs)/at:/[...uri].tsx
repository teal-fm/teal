import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import RightRail from "@/components/teal/RightRail";
import TealShell from "@/components/teal/TealShell";
import { Text } from "@/components/ui/text";
import { hrefFromAtUri } from "@/lib/teal/routes";

function atUriFromParams(param: string | string[] | undefined) {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.startsWith("/at://")) {
      return `at://${decodeURIComponent(path.slice("/at://".length))}`;
    }
    if (path.startsWith("/at:/")) {
      return `at://${decodeURIComponent(path.slice("/at:/".length))}`;
    }
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
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen options={{ title: "AT URI", headerShown: false }} />
      <View className="rounded-lg border border-border bg-card p-5">
        <Text className="font-mono text-xs uppercase text-primary">
          AT URI
        </Text>
        <Text className="mt-2 font-sans text-2xl font-black">
          Unsupported Teal link
        </Text>
        <Text className="mt-2 text-muted-foreground">
          Teal can open profile, listen, and post AT-URIs.
        </Text>
      </View>
    </TealShell>
  );
}
