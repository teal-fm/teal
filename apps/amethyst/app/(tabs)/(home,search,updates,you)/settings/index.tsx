import { useState } from "react";
import { View } from "react-native";
import { Link, Stack } from "expo-router";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import pkg from "@/package.json";
import { useStore } from "@/stores/mainStore";

export default function Settings() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const appviewDid = useStore((state) => state.tealDid);
  const setAppviewDid = useStore((state) => state.setTealDid);
  const status = useStore((state) => state.status);
  const [advanced, setAdvanced] = useState(false);
  const [provider, setProvider] = useState(appviewDid || "");
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [providerError, setProviderError] = useState(false);

  function saveProvider() {
    const value = provider.trim();
    if (!/^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/.test(value)) {
      setProviderError(true);
      setProviderMessage(
        "Enter a valid provider DID, such as did:web:teal.fm.",
      );
      return;
    }
    setAppviewDid(value);
    setProviderError(false);
    setProviderMessage("Provider saved.");
  }

  return (
    <TealShell pageTitle="Settings">
      <Stack.Screen options={{ title: "Settings", headerShown: false }} />
      <SectionHeading title="Settings" level={1} />
      <View className="gap-8">
        <View className="gap-3">
          <Text role="heading" aria-level={3} className="text-lg font-semibold">
            Appearance
          </Text>
          <Text className="text-sm text-muted-foreground">
            Choose a theme, or follow your device.
          </Text>
          <View
            role="group"
            accessibilityLabel="Theme"
            className="flex-row flex-wrap gap-2"
          >
            {(["light", "dark", "system"] as const).map((value) => (
              <Button
                key={value}
                variant={colorScheme === value ? "default" : "outline"}
                accessibilityState={{ selected: colorScheme === value }}
                aria-pressed={colorScheme === value}
                onPress={() => setColorScheme(value)}
              >
                <Text>{value[0].toUpperCase() + value.slice(1)}</Text>
              </Button>
            ))}
          </View>
        </View>
        <View className="gap-3 border-t border-border pt-6">
          <Text role="heading" aria-level={3} className="text-lg font-semibold">
            Account
          </Text>
          <Link
            href={status === "loggedIn" ? "/auth/logoutModal" : "/auth/login"}
            asChild
          >
            <Button variant="outline" className="self-start">
              <Text>{status === "loggedIn" ? "Sign out" : "Sign in"}</Text>
            </Button>
          </Link>
        </View>
        <View className="gap-3 border-t border-border pt-6">
          <Button
            variant="ghost"
            className="self-start"
            accessibilityState={{ expanded: advanced }}
            aria-expanded={advanced}
            onPress={() => setAdvanced((value) => !value)}
          >
            <Text>
              {advanced ? "Hide advanced settings" : "Advanced settings"}
            </Text>
          </Button>
          {advanced && (
            <View className="gap-3">
              <Text nativeID="provider-label" className="font-semibold">
                AppView provider DID
              </Text>
              <Text
                nativeID="provider-help"
                className="text-sm text-muted-foreground"
              >
                This identifies the service that supplies Teal's feeds and
                statistics. Change it only when you want to use another
                provider.
              </Text>
              <View className="flex-row flex-wrap items-center gap-3">
                <Input
                  nativeID="provider-input"
                  accessibilityLabel="AppView provider DID"
                  aria-labelledby="provider-label"
                  aria-describedby="provider-help"
                  className="min-w-0 flex-1"
                  value={provider}
                  onChangeText={(value) => {
                    setProvider(value);
                    setProviderMessage(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="did:web:teal.fm"
                />
                <Button
                  disabled={provider.trim() === appviewDid}
                  onPress={saveProvider}
                >
                  <Text>Save provider</Text>
                </Button>
              </View>
              {providerMessage && (
                <Text
                  role={providerError ? "alert" : "status"}
                  className={
                    providerError
                      ? "text-sm text-destructive"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {providerMessage}
                </Text>
              )}
              <Text className="text-sm text-muted-foreground">
                Teal {pkg.version}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TealShell>
  );
}
