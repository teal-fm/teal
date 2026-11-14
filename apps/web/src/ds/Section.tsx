import type { ReactNode } from "react";
import { cn } from "@teal/client/utils";

import { Glass } from "./Glass";
import { A } from "./Link";
import { Heading } from "./Text";

/** A titled block of a page. Pass `panel` to set its contents in glass. */
export function Section({
  title,
  detail,
  more,
  panel,
  children,
  className,
}: {
  title: string;
  /** A short note beside the title, such as a count or period. */
  detail?: string;
  /** A "See all" style link. */
  more?: { label: string; href: string };
  panel?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const header = (
    <div className="mb-3 flex items-end justify-between gap-3">
      <Heading level={2} onBackdrop={!panel} className="min-w-0 flex-1">
        {title}
      </Heading>
      {more ? (
        <A href={more.href} className={cn("flex min-h-9 items-center text-[15px] font-semibold text-tint hover:underline", !panel && "halo")}>
          {more.label}
        </A>
      ) : detail ? (
        <span className={cn("pb-0.5 text-[14px] tabular-nums text-ink-2", !panel && "halo")}>{detail}</span>
      ) : null}
    </div>
  );
  if (panel) {
    return (
      <Glass as="section" className={cn("p-4", className)}>
        {header}
        {children}
      </Glass>
    );
  }
  return (
    <section className={className}>
      {header}
      {children}
    </section>
  );
}

/** A row: something leading (cover, avatar), a title and line, and something trailing. */
export function Row({
  href,
  onClick,
  leading,
  title,
  subtitle,
  meta,
  trailing,
  label,
  divider = true,
}: {
  href?: string;
  onClick?: () => void;
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  /** The accessible name when the visible text isn't enough. */
  label?: string;
  divider?: boolean;
}) {
  const body = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-ink">{title}</span>
        {subtitle ? <span className="truncate text-[14px] text-ink-2">{subtitle}</span> : null}
        {meta ? <span className="truncate text-[13px] tabular-nums text-ink-2">{meta}</span> : null}
      </span>
    </>
  );
  const rowClass = cn("flex items-center gap-3 py-2.5", divider && "border-b border-hair");
  if (href) {
    return (
      <div className={rowClass}>
        <A href={href} aria-label={label} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
          {body}
        </A>
        {trailing}
      </div>
    );
  }
  if (onClick) {
    return (
      <div className={rowClass}>
        <button type="button" aria-label={label} onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80">
          {body}
        </button>
        {trailing}
      </div>
    );
  }
  return (
    <div className={rowClass}>
      {body}
      {trailing}
    </div>
  );
}
