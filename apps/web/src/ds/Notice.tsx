import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@teal/client/utils";

import { Button } from "./Button";
import { Glass } from "./Glass";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";
import { Heading } from "./Text";

/** An empty, signed-out, or informational state in a glass panel. */
export function Notice({
  title,
  body,
  icon,
  action,
  center,
  className,
}: {
  title: string;
  body?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <Glass className={cn("flex flex-col gap-2 p-5", center && "items-center text-center", className)}>
      {icon ? (
        <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-tint-soft">
          <Icon icon={icon} size={22} className="text-tint" />
        </span>
      ) : null}
      <Heading level={2} size="card">
        {title}
      </Heading>
      {body ? <p className="text-[15px] text-ink-2">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Glass>
  );
}

/** Something failed to load. Never shows raw error text; always offers a retry. */
export function ErrorNotice({
  title,
  body = "Check your connection and try again.",
  onRetry,
  className,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={className}>
      <Notice
        title={title}
        body={body}
        action={onRetry ? <Button label="Try again" variant="secondary" size="sm" onClick={onRetry} /> : null}
      />
    </div>
  );
}

export function Loading({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <Spinner label={label} className="size-6" />
    </div>
  );
}
