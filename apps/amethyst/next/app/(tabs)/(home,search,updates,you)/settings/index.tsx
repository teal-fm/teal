import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { canOverrideColorScheme, useColorScheme } from "@/lib/useColorScheme";
import { Button, Choices, Field, Section, Screen, Text } from "@/next/components/ds";
import pkg from "@/package.json";
import { useStore } from "@/stores/mainStore";

const DID = /^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/;

export default function Settings() {
  const { preference, setColorScheme } = useColorScheme();
  const status = useStore((state) => state.status);
  const appviewDid = useStore((state) => state.tealDid);
  const setAppviewDid = useStore((state) => state.setTealDid);
  const [advanced, setAdvanced] = useState(false);
  const [provider, setProvider] = useState(appviewDid || "");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const saveProvider = () => {
    const value = provider.trim();
    if (!DID.test(value)) {
      setMessage({ text: "Enter a valid provider DID, such as did:web:teal.fm.", error: true });
      return;
    }
    setAppviewDid(value);
    setMessage({ text: "Provider saved.", error: false });
  };

  return (
    <Screen title="Settings" back>
      <Section title="Appearance" panel>
        {canOverrideColorScheme ? (
          <View className="gap-3">
            <Text className="text-[15px] text-ink-2">Choose a theme, or follow your device.</Text>
            <Choices
              label="Theme"
              value={preference}
              onChange={setColorScheme}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </View>
        ) : (
          <Text className="text-[15px] text-ink-2">Teal follows your device's light or dark setting.</Text>
        )}
      </Section>

      <Section title="Account" panel>
        <Link href={status === "loggedIn" ? "/auth/logout" : "/auth/login"} asChild>
          <Button label={status === "loggedIn" ? "Sign out" : "Sign in"} variant="secondary" />
        </Link>
      </Section>

      <Section title="Advanced" panel>
        <Button
          label={advanced ? "Hide provider settings" : "Change the AppView provider"}
          variant="plain"
          icon={advanced ? ChevronDown : ChevronRight}
          aria-expanded={advanced}
          onPress={() => setAdvanced((value) => !value)}
          className="-ml-3 px-3"
        />
        {advanced ? (
          <View className="mt-2 gap-3">
            <Field
              label="AppView provider DID"
              hint="The service that supplies Teal's feeds and statistics. Change it only to use another provider."
              value={provider}
              onChangeText={(value) => {
                setProvider(value);
                setMessage(null);
              }}
              error={message?.error ? message.text : null}
              placeholder="did:web:teal.fm"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button label="Save provider" disabled={provider.trim() === appviewDid} onPress={saveProvider} />
            {message && !message.error ? (
              <Text role="status" className="text-[14px] text-ink-2">
                {message.text}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Section>

      <Text onBackdrop className="text-center text-[13px] text-ink-2">
        Teal {pkg.version}
      </Text>
    </Screen>
  );
}
