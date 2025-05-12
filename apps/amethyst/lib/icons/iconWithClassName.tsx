import React from "react";
import type { FontAwesome6 } from "@expo/vector-icons";
import type { LucideIcon } from "lucide-react-native";
import { cssInterop } from "nativewind";

import {
  GlobalTextClassContext,
  TextClassContext,
} from "../../components/ui/text";
import { cn } from "../utils";

/// This type is used to support multiple icon libraries.
type SupportedIcons = LucideIcon | typeof FontAwesome6;

/// Function to ClassNameify an icon.
/// If you want to use an icon in multiple places,
/// consider creating a component based on the iconWithClassName function instead.
export function Icon(props: {
  icon: SupportedIcons;
  name?: string;
  className?: string;
  size?: number;
}) {
  const Name = props.icon;
  const textClass = React.useContext(TextClassContext);
  const globalTextClass = React.useContext(GlobalTextClassContext);
  iconWithClassName(Name);
  return (
    <Name
      size={props.size ? props.size : 28}
      className={cn(
        globalTextClass,
        "text-foreground",
        props.className,
        textClass,
      )}
      {...props}
    />
  );
}

/// TWify icons with className.
export function iconWithClassName(icon: SupportedIcons | SupportedIcons[]) {
  if (Array.isArray(icon)) {
    icon.forEach((i) =>
      cssInterop(i, {
        className: {
          target: "style",
          nativeStyleToProp: {
            color: true,
            opacity: true,
          },
        },
      }),
    );
  } else {
    cssInterop(icon, {
      className: {
        target: "style",
        nativeStyleToProp: {
          color: true,
          opacity: true,
        },
      },
    });
  }
}
