import React from "react";
import type { FontAwesome6 } from "@expo/vector-icons";
import type { LucideIcon } from "lucide-react-native";
import { styled } from "nativewind";

import {
  GlobalTextClassContext,
  TextClassContext,
} from "../../components/ui/text";
import { cn } from "../utils";

/// This type is used to support multiple icon libraries.
type SupportedIcons = LucideIcon | typeof FontAwesome6;

// Icons read colour and opacity as props on native, so class styles are mapped onto them.
const styledIcons = new WeakMap<object, React.ComponentType<any>>();

/// TWify an icon with className. Returns the styled component for that icon.
export function iconWithClassName(icon: SupportedIcons): React.ComponentType<any> {
  let StyledIcon = styledIcons.get(icon);
  if (!StyledIcon) {
    StyledIcon = styled(icon as React.ComponentType<any>, {
      className: {
        target: "style",
        nativeStyleMapping: { color: true, opacity: true },
      },
    }) as React.ComponentType<any>;
    styledIcons.set(icon, StyledIcon);
  }
  return StyledIcon;
}

export function Icon(props: {
  icon: SupportedIcons;
  name?: string;
  className?: string;
  size?: number;
}) {
  const { icon, className, size, ...rest } = props;
  const textClass = React.useContext(TextClassContext);
  const globalTextClass = React.useContext(GlobalTextClassContext);
  const StyledIcon = iconWithClassName(icon);
  return (
    <StyledIcon
      size={size ?? 28}
      className={cn(globalTextClass, "text-foreground", className, textClass)}
      {...rest}
    />
  );
}
