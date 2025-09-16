import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Link, Stack } from "expo-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { useStore } from "@/stores/mainStore";

import { MiniProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import { OutputSchema as SearchActorsOutputSchema } from "@teal/lexicons/src/types/fm/teal/alpha/actor/searchActors";

export default function Search() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = useState<MiniProfileView[]>([]);

  const tealDid = useStore((state) => state.tealDid);
  const agent = useStore((state) => state.pdsAgent);

  useEffect(() => {
    let isMounted = true;

    const fetchResults = async () => {
      if (!agent || !searchQuery) {
        // Don't fetch if searchQuery is empty
        setSearchResults([]); // Clear results when searchQuery is empty
        return;
      }
      try {
        let res = await agent.call(
          "fm.teal.alpha.actor.searchActors",
          { q: searchQuery },
          {},
          { headers: { "atproto-proxy": tealDid + "#teal_fm_appview" } },
        );
        if (isMounted) {
          setSearchResults(
            res.data["actors"] as SearchActorsOutputSchema["actors"],
          );
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchResults();

    return () => {
      isMounted = false;
    };
  }, [agent, tealDid, searchQuery]);

  return (
    <ScrollView className="w-full flex-1 items-center justify-start gap-5 bg-background">
      <Stack.Screen
        options={{
          title: "Search",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="my-2 mt-5 flex w-screen max-w-2xl flex-1 flex-col gap-4 divide-y divide-muted-foreground/50 rounded-xl p-4">
        <Input
          placeholder="Search for users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <View className="mx-5 my-2">
        {searchResults.map((user) => (
          <Link
            href={`/profile/${user.handle?.replace("at://", "")}`}
            key={user.did}
            className="flex flex-row items-center gap-4 rounded-xl p-2 hover:bg-muted-foreground/20"
          >
            <Avatar
              alt={`${user.displayName}'s profile`}
              className="h-14 w-14 border border-border"
            >
              <AvatarImage
                source={{
                  uri:
                    user.avatar &&
                    getImageCdnLink({
                      did: user.did!,
                      hash: user.avatar,
                    }),
                }}
              />
              <AvatarFallback>
                <Text>
                  {user.displayName?.substring(0, 1) ??
                    user.handle?.substring(0, 1) ??
                    "R"}
                </Text>
              </AvatarFallback>
            </Avatar>
            <View className="flex flex-col">
              <Text className="font-semibold">{user.displayName}</Text>
              <Text className="text-muted-foreground">
                {user.handle?.replace("at://", "@")}
              </Text>
            </View>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}
