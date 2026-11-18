import { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { cn } from "@teal/client/utils";

/**
 * A panel over the backdrop. Android has no backdrop blur, so it uses a strong
 * translucent fill that keeps text at contrast over any cover.
 */
export function Glass({
  children,
  className,
  ...props
}: ViewProps & { children?: ReactNode; className?: string }) {
  return (
    <View
      className={cn("overflow-hidden rounded-[26px] border border-glass-edge bg-glass-strong", className)}
      {...props}
    >
      {children}
    </View>
  );
}
