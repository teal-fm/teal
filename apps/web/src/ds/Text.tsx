import type { HTMLAttributes } from "react";
import { cn } from "@teal/client/utils";

const HEADING_SIZES = {
  screen: "text-[34px] leading-[40px] font-bold tracking-tight",
  hero: "text-[30px] leading-[34px] font-bold tracking-tight sm:text-[40px] sm:leading-[44px]",
  title: "text-[22px] leading-[28px] font-bold",
  card: "text-[17px] leading-[22px] font-semibold",
} as const;

/** A heading at its document level. `onBackdrop` adds the halo for text set on the blurred covers. */
export function Heading({
  level = 2,
  size = level === 1 ? "screen" : "title",
  onBackdrop,
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3;
  size?: keyof typeof HEADING_SIZES;
  onBackdrop?: boolean;
}) {
  const Tag = `h${level}` as const;
  return <Tag className={cn("text-ink", HEADING_SIZES[size], onBackdrop && "halo", className)} {...props} />;
}
