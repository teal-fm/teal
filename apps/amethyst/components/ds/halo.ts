import { Platform, type TextStyle } from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";

/**
 * Text set straight on the blurred backdrop gets a soft halo in the ground colour,
 * so a bright patch of cover under a word cannot drop it below AA contrast.
 */
export function useHalo(): TextStyle {
  const { isDarkColorScheme } = useColorScheme();
  const color = isDarkColorScheme ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.8)";
  if (Platform.OS === "web") {
    // A tight inner shadow lifts the glyph edges; the wide one softens the patch behind them.
    return { textShadow: `0 0 3px ${color}, 0 0 12px ${color}` } as TextStyle;
  }
  return { textShadowColor: color, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } };
}

/** Placeholder text in fields; clears 4.5:1 on the ground and on fill in both themes. */
export function usePlaceholderColor() {
  const { isDarkColorScheme } = useColorScheme();
  return isDarkColorScheme ? "#98989d" : "#6e6e73";
}
