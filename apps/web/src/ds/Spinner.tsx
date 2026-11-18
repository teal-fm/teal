import { cn } from "@teal/client/utils";

/** A small activity indicator in the current text colour. */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent text-ink-2 motion-reduce:animate-[spin_1.5s_linear_infinite]",
        className,
      )}
    />
  );
}
