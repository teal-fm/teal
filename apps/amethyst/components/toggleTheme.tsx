import { useColorScheme } from "nativewind";
import { Text } from "@/components/ui/text";

export default function ToggleTheme() {
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <Text
      onPress={() => setColorScheme(colorScheme === "light" ? "dark" : "light")}
    >
      {`The color scheme is ${colorScheme}`}
    </Text>
  );
}
