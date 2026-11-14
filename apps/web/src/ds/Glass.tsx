import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@teal/client/utils";

/** A frosted panel over the backdrop. */
export const Glass = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { strong?: boolean; as?: "div" | "section" | "nav" | "aside" | "article" }>(
  function Glass({ className, strong, as: Tag = "div", ...props }, ref) {
    return (
      <Tag
        ref={ref}
        className={cn(
          "overflow-hidden rounded-[26px] border border-glass-edge backdrop-blur-2xl backdrop-saturate-150",
          strong ? "bg-glass-strong" : "bg-glass",
          className,
        )}
        {...props}
      />
    );
  },
);
