import { Platform, type TextStyle } from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";

/**
 * Text set straight on the blurred backdrop gets a soft halo in the ground colour,
 * so a bright patch of cover under a word cannot drop it below AA contrast.
 */
export function useHalo(): TextStyle {
  const { isDarkColorScheme } = useColorScheme();
  const color = isDarkColorScheme ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.65)";
  if (Platform.OS === "web") {
    return { textShadow: `0 0 10px ${color}` } as TextStyle;
  }
  return { textShadowColor: color, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } };
}
