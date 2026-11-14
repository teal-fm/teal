import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@teal/client/utils";

import { IconButton } from "./Button";
import { Heading } from "./Text";

/**
 * A modal sheet on the native <dialog> element, which traps focus, closes on
 * Escape, and returns focus to whatever opened it.
 */
export function Dialog({
  open = true,
  title,
  description,
  onClose,
  children,
  className,
}: {
  open?: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-[26px] border border-glass-edge bg-ground p-0 text-ink backdrop:bg-black/40",
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-6 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Heading level={1} size="title" id={titleId}>
              {title}
            </Heading>
            {description ? <p className="text-[15px] text-ink-2">{description}</p> : null}
          </div>
          <IconButton icon={X} label="Close" size={36} onClick={onClose} />
        </div>
        {children}
      </div>
    </dialog>
  );
}
