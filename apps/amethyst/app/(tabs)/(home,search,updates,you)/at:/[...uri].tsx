import { useMemo } from "react";
import { Platform } from "react-native";
import { Link, Redirect, useLocalSearchParams } from "expo-router";
import { atUriFromRoutePath, hrefFromAtUri } from "@/lib/teal/routes";
import { Button, Notice, Screen } from "@/components/ds";

function atUriFromParams(param: string | string[] | undefined) {
  if (Platform.OS === "web") {
    const fromPath = atUriFromRoutePath(window.location.pathname);
    if (fromPath) return fromPath;
  }
  const parts = Array.isArray(param) ? param : param ? [param] : [];
  return parts.length ? `at://${parts.join("/")}` : undefined;
}

/** Opens an at:// link (a listen, post, playlist, or profile) at its teal page. */
export default function AtUriLink() {
  const params = useLocalSearchParams();
  const uri = useMemo(() => atUriFromParams(params.uri), [params.uri]);
  const href = hrefFromAtUri(uri);
  if (href) return <Redirect href={href as never} />;
  return (
    <Screen back pageTitle="Unsupported link">
      <Notice
        title="Teal can't open this link"
        body="It points to a record teal doesn't show yet."
        action={
          <Link href="/" asChild>
            <Button label="Go to Today" size="sm" />
          </Link>
        }
      />
    </Screen>
  );
}
