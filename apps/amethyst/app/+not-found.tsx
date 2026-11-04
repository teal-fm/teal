import { View } from "react-native";
import { Link } from "expo-router";
import { CircleAlert } from "lucide-react-native";
import { Button, ButtonRow, Glass, Heading, Icon, PageTitle, Text } from "@/components/ds";

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center bg-ground px-4">
      <PageTitle title="Page not found" />
      <Glass className="w-full max-w-md items-center gap-3 p-7">
        <Icon icon={CircleAlert} size={40} className="text-ink-2" />
        <Heading level={1} size="title" className="text-center">
          Page not found
        </Heading>
        <Text className="text-center text-[15px] text-ink-2">This link may be incomplete, or the page may have moved.</Text>
        <ButtonRow>
          <Link href="/" asChild>
            <Button label="Go to Today" />
          </Link>
          <Link href="/search" asChild>
            <Button label="Explore music" variant="secondary" />
          </Link>
        </ButtonRow>
      </Glass>
    </View>
  );
}
