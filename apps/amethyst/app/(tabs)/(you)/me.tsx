import { Redirect } from "expo-router";
import { View } from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useStore } from "@/stores/mainStore";

/** The You tab: your own profile when signed in, a way in when not. */
export default function Me() {
  const status = useStore((state) => state.status);
  const did = useStore((state) => state.pdsAgent?.did);

  if (status === "loggedIn" && did) {
    return <Redirect href={`/profile/${did}`} />;
  }
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-ground px-8">
      <Text role="heading" aria-level={1} className="text-center text-[28px] font-bold text-ink">
        Your listening, yours
      </Text>
      <Text className="text-center text-[17px] text-ink-2">
        Sign in with your Atmosphere account to see your profile, favourites, and month in covers.
      </Text>
      <Link href="/auth/login" asChild>
        <Button className="mt-2 rounded-full bg-tint px-6">
          <Text className="font-semibold text-on-tint">Sign in</Text>
        </Button>
      </Link>
    </View>
  );
}
