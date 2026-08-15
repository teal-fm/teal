import { Pressable } from "react-native";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useColorScheme } from "@/lib/useColorScheme";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react-native";

import { Text } from "./ui/text";

export default function ToggleTheme({ compact = false }: { compact?: boolean }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? "Light mode" : "Dark mode";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${label.toLowerCase()}`}
      accessibilityHint="Changes the theme immediately"
      onPress={() => setColorScheme(nextTheme)}
      className={cn(
        "flex-row items-center gap-2 rounded-lg border border-border bg-card/70 web:transition-colors web:hover:border-primary/50",
        compact ? "h-9 w-9 justify-center" : "px-3 py-2",
      )}
    >
      <Icon
        icon={isDark ? Sun : Moon}
        size={16}
        className="text-primary"
      />
      {!compact && <Text className="text-xs font-semibold">{label}</Text>}
    </Pressable>
  );
}
