import type { TextStyle } from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";

/**
 * Text set straight on the blurred backdrop gets a soft halo in the ground colour,
 * so a bright patch of cover under a word cannot drop it below AA contrast.
 */
export function useHalo(): TextStyle {
  const { isDarkColorScheme } = useColorScheme();
  const color = isDarkColorScheme ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.8)";

  return { textShadowColor: color, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } };
}

/** Placeholder text in fields; clears 4.5:1 on the ground and on fill in both themes. */
export function usePlaceholderColor() {
  const { isDarkColorScheme } = useColorScheme();

  return isDarkColorScheme ? "#98989d" : "#636366";
}
