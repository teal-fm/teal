import { forwardRef } from "react";
import { Text as RNText, type TextProps } from "react-native";
import { cn } from "@teal/client/utils";

import { useHalo } from "./halo";

export type DsTextProps = TextProps & {
  className?: string;
  /** Text set straight on the blurred backdrop gets a halo so covers can't drop its contrast. */
  onBackdrop?: boolean;
};

/** Body text in the system face. Colour defaults to ink; pass `text-ink-2` to recede. */
export const Text = forwardRef<RNText, DsTextProps>(function Text(
  { className, onBackdrop, style, ...props },
  ref,
) {
  const halo = useHalo();
  return (
    <RNText
      ref={ref}
      className={cn("font-sans text-[16px] text-ink web:select-text", className)}
      style={onBackdrop ? [halo, style] : style}
      {...props}
    />
  );
});

const HEADING_SIZES = {
  screen: "text-[34px] leading-[40px] font-bold tracking-tight",
  hero: "text-[30px] leading-[34px] font-bold tracking-tight sm:text-[40px] sm:leading-[44px]",
  title: "text-[22px] leading-[28px] font-bold",
  card: "text-[17px] leading-[22px] font-semibold",
} as const;

/** A heading with its level announced to assistive tech. */
export function Heading({
  level = 2,
  size = level === 1 ? "screen" : "title",
  className,
  ...props
}: DsTextProps & { level?: 1 | 2 | 3; size?: keyof typeof HEADING_SIZES }) {
  return (
    <Text
      role="heading"
      aria-level={level}
      className={cn(HEADING_SIZES[size], className)}
      {...props}
    />
  );
}
