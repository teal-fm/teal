import { ReactNode } from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { useColorScheme } from "@/lib/useColorScheme";
import { cn } from "@teal/client/utils";

/**
 * A frosted panel over the backdrop. iOS uses the system material; the web uses
 * a backdrop filter; Android, where backdrop blur is not available, uses a
 * stronger translucent fill so text keeps its contrast.
 */
export function Glass({
  children,
  className,
  strong = false,
  ...props
}: ViewProps & { children?: ReactNode; className?: string; strong?: boolean }) {
  const { isDarkColorScheme } = useColorScheme();
  const fill =
    Platform.OS === "android" || strong ? "bg-glass-strong" : "bg-glass";
  return (
    <View
      className={cn(
        "overflow-hidden rounded-[26px] border border-glass-edge",
        fill,
        Platform.OS === "web" && "backdrop-blur-2xl backdrop-saturate-150",
        className,
      )}
      {...props}
    >
      {Platform.OS === "ios" && (
        <BlurView
          intensity={60}
          tint={
            isDarkColorScheme
              ? "systemThinMaterialDark"
              : "systemThinMaterialLight"
          }
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}
