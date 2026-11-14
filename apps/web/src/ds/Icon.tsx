import type { LucideIcon } from "lucide-react";
import { cn } from "@teal/client/utils";

/** A Lucide icon coloured with a text class (ink by default). Decorative unless labelled. */
export function Icon({
  icon: Glyph,
  size = 20,
  className,
  label,
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Glyph
      size={size}
      className={cn("shrink-0 text-ink", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
