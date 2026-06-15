import React, { useState } from "react";
import { Switch, View } from "react-native";
import { Link, Stack } from "expo-router";
import RightRail from "@/components/teal/RightRail";
import TealShell, {
  SectionHeading,
} from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { syncPlaysToPopfeed } from "@/lib/popfeed";
import { getActorFeed } from "@/lib/teal/api";
import { useColorScheme } from "@/lib/useColorScheme";
import { cn } from "@/lib/utils";
import pkg from "@/package.json";
import { useStore } from "@/stores/mainStore";

const POPFEED_BACKFILL_PAGE_LIMIT = 100;
const POPFEED_BACKFILL_MAX_PLAYS = 1000;

export default function Settings() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const authStatus = useStore((state) => state.status);
  const pdsAgent = useStore((state) => state.pdsAgent);
  const appviewDid = useStore((state) => state.tealDid);
  const setAppviewDid = useStore((state) => state.setTealDid);
  const popfeedSyncEnabled = useStore((state) => state.popfeedSyncEnabled);
  const setPopfeedSyncEnabled = useStore(
    (state) => state.setPopfeedSyncEnabled,
  );
  const [popfeedBackfillStatus, setPopfeedBackfillStatus] = useState<
    "idle" | "syncing" | "done" | "error"
  >("idle");
  const [popfeedBackfillMessage, setPopfeedBackfillMessage] = useState("");

  const colorSchemeOptions = [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "System", value: "system" },
  ];

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{
          title: "Settings",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <SectionHeading eyebrow="Preferences" title="Settings" />
      <View className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
        <ButtonSelector
          text="Theme"
          values={colorSchemeOptions}
          selectedValue={colorScheme}
          setSelectedValue={setColorScheme}
        />
        <TextInputRow
          labelText="Appview DID"
          initialValue={appviewDid || ""} // Ensure currentValue is a string
          onSubmit={(e) => setAppviewDid(e)}
          placeholder="Enter your Appview DID (e.g., did:web:...)"
        />
        <ToggleSwitch
          text="Sync first listens to Popfeed"
          isEnabled={popfeedSyncEnabled}
          setIsEnabled={setPopfeedSyncEnabled}
        />
        {popfeedSyncEnabled && authStatus === "loggedIn" && pdsAgent?.did && (
          <PopfeedBackfillRow
            disabled={popfeedBackfillStatus === "syncing"}
            message={popfeedBackfillMessage}
            status={popfeedBackfillStatus}
            onPress={async () => {
              const viewerDid = pdsAgent.did;
              if (!viewerDid) return;
              setPopfeedBackfillStatus("syncing");
              setPopfeedBackfillMessage("");
              try {
                let cursor: string | undefined;
                let created = 0;
                let skipped = 0;
                let indexedPlays = 0;
                do {
                  const page = await getActorFeed(
                    viewerDid,
                    POPFEED_BACKFILL_PAGE_LIMIT,
                    cursor,
                  );
                  indexedPlays += page.plays.length;
                  const result = await syncPlaysToPopfeed(
                    pdsAgent,
                    page.plays.map((play) => ({ play })),
                  );
                  created += result.created;
                  skipped += result.skipped;
                  cursor = page.cursor;
                } while (cursor && indexedPlays < POPFEED_BACKFILL_MAX_PLAYS);

                const capReached = Boolean(
                  cursor && indexedPlays >= POPFEED_BACKFILL_MAX_PLAYS,
                );
                setPopfeedBackfillStatus("done");
                setPopfeedBackfillMessage(
                  `Synced ${created} Popfeed items from ${indexedPlays} indexed plays. Skipped ${skipped}.${capReached ? " Run again later to continue." : ""}`,
                );
              } catch (error) {
                console.error("Failed to sync recent plays to Popfeed:", error);
                setPopfeedBackfillStatus("error");
                setPopfeedBackfillMessage("Could not sync recent plays.");
              }
            }}
          />
        )}
        <Link href="/auth/logoutModal" asChild>
          <Button variant="destructive" size="sm" className="w-max pb-1">
            <Text>Sign out</Text>
          </Button>
        </Link>
        <View>
          <Text className="text-muted-foreground">
            teal.fm amethyst ver. {pkg.version}
          </Text>
          <Text className="text-muted-foreground">
            react native{" "}
            {pkg.dependencies["react-native"]
              .replace("~", "")
              .split(".")
              .slice(0, 2)
              .join(".")}
            , expo {pkg.dependencies.expo.split(".")[0].replace("~", "")}.
          </Text>
        </View>
      </View>
    </TealShell>
  );
}

function PopfeedBackfillRow({
  disabled,
  message,
  onPress,
  status,
}: {
  disabled: boolean;
  message: string;
  onPress: () => void;
  status: "idle" | "syncing" | "done" | "error";
}) {
  return (
    <View className="items-start gap-2 pt-2">
      <Button disabled={disabled} onPress={onPress} size="sm">
        <Text>
          {status === "syncing" ? "Syncing Popfeed..." : "Sync recent plays"}
        </Text>
      </Button>
      {message && (
        <Text
          className={cn(
            "text-sm text-muted-foreground",
            status === "error" ? "text-destructive" : "",
          )}
        >
          {message}
        </Text>
      )}
    </View>
  );
}

function ToggleSwitch({
  text,
  isEnabled,
  setIsEnabled,
}: {
  text: string;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-lg">{text}</Text>
      <Switch
        className="ml-4"
        value={isEnabled}
        onValueChange={setIsEnabled}
      />
    </View>
  );
}

/// A selector component for smaller selections (usu. <3 values)
function ButtonSelector({
  text,
  values,
  selectedValue,
  setSelectedValue,
}: {
  text: string;
  values: { label: string; value: string }[];
  selectedValue: string;
  setSelectedValue: (value: any) => void;
}) {
  return (
    <View className="items-start gap-2 pt-2">
      <Text className="text-base font-semibold">{text}</Text>
      <View className="h-10 w-full flex-row items-center justify-around gap-1 rounded-lg bg-muted px-1">
        {values.map(({ label, value }) => (
          <Button
            key={value}
            onPress={() => setSelectedValue(value)}
            className={`h-8 w-full flex-1`}
            variant={selectedValue === value ? "secondary" : "ghost"}
          >
            <Text
              className={cn(
                selectedValue === value
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </Text>
          </Button>
        ))}
      </View>
    </View>
  );
}

function TextInputRow({
  labelText,
  initialValue = "", // Added initialValue prop, defaults to empty string
  onSubmit,
  placeholder,
}: {
  labelText: string;
  initialValue?: string; // Made initialValue optional
  onSubmit: (value: string) => void; // onSubmit now takes the string value
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState(initialValue); // Internal state for the input

  const handleSubmit = () => {
    onSubmit(inputValue);
  };

  return (
    <View className="items-start gap-2 pt-2">
      <Text className="text-base font-semibold">{labelText}</Text>
      <View className="w-full flex-row items-center gap-2">
        <Input
          className="h-10 w-full rounded-md border border-muted-foreground/50 bg-transparent px-3 py-2 text-base text-foreground"
          value={inputValue}
          onChangeText={setInputValue} // Update internal state on change
          placeholder={placeholder}
          placeholderTextColor="hsl(var(--muted-foreground))"
        />
        <Button onPress={handleSubmit} size="sm">
          <Text>Submit</Text>
        </Button>
      </View>
    </View>
  );
}
