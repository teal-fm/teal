import React from "react";
import { StyleSheet, View } from "react-native";
import { Link, Redirect, Stack, usePathname } from "expo-router";
import { atUriFromRoutePath, hrefFromAtUri } from "@/lib/teal/routes";

import { Text } from "../components/ui/text";

export default function NotFoundScreen() {
  const pathname = usePathname();
  const atUri =
    typeof window !== "undefined"
      ? atUriFromRoutePath(window.location.pathname)
      : atUriFromRoutePath(pathname);
  const href = hrefFromAtUri(atUri);

  if (href) {
    return <Redirect href={href as any} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <Text>This screen doesn't exist.</Text>

        <Link href="/" style={styles.link}>
          <Text>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: "#2e78b7",
  },
});
