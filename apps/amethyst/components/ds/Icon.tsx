import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react-native";
import { styled } from "nativewind";
import { cn } from "@teal/client/utils";

// Icons read colour as a prop on native, so class colours are mapped onto it.
const styledIcons = new WeakMap<object, ComponentType<any>>();

function styledIcon(icon: LucideIcon) {
  let StyledIcon = styledIcons.get(icon);
  if (!StyledIcon) {
    StyledIcon = styled(icon as ComponentType<any>, {
      className: { target: "style", nativeStyleMapping: { color: true, opacity: true } },
    }) as ComponentType<any>;
    styledIcons.set(icon, StyledIcon);
  }
  return StyledIcon;
}

/** A Lucide icon coloured with a text class (ink by default). Decorative unless labelled. */
export function Icon({
  icon,
  size = 20,
  className,
  label,
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
  label?: string;
}) {
  const StyledIcon = styledIcon(icon);
  return (
    <StyledIcon
      size={size}
      className={cn("text-ink", className)}
      aria-hidden={label ? undefined : true}
      accessibilityLabel={label}
    />
  );
}
