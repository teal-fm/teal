import { Link, Redirect } from "expo-router";
import { UserRound } from "lucide-react-native";
import { Button, Notice, Screen } from "@/next/components/ds";
import { useStore } from "@/stores/mainStore";

/** The You tab: your own profile when signed in, a way in when not. */
export default function Me() {
  const status = useStore((state) => state.status);
  const did = useStore((state) => state.pdsAgent?.did);
  if (status === "loggedIn" && did) return <Redirect href={`/profile/${did}`} />;
  return (
    <Screen title="You">
      <Notice
        center
        icon={UserRound}
        title="Your listening, yours"
        body="Sign in with your Atmosphere account to see your profile, favourites, and month in covers."
        action={
          <Link href="/auth/login" asChild>
            <Button label="Sign in" />
          </Link>
        }
      />
    </Screen>
  );
}
