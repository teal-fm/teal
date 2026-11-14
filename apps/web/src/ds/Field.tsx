import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@teal/client/utils";

type Common = {
  label: string;
  /** Hide the visible label when the context already names the field. */
  hideLabel?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
};

function Frame({ id, label, hideLabel, hint, error, children }: Common & { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn("text-[14px] font-semibold text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-message`} className="text-[13px] text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const box = (error?: string | null) =>
  cn(
    "w-full rounded-[14px] border bg-fill px-3.5 text-[16px] text-ink outline-none",
    error ? "border-destructive" : "border-hair",
  );

/** A labelled text field. Keyboard focus shows a tint border (see styles.css). */
export const Field = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(function Field(
  { label, hideLabel, hint, error, className, id: given, ...props },
  ref,
) {
  const generated = useId();
  const id = given ?? generated;
  return (
    <Frame id={id} label={label} hideLabel={hideLabel} hint={hint} error={error}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={cn(box(error), "h-12", className)}
        {...props}
      />
    </Frame>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, Common & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ label, hideLabel, hint, error, className, id: given, ...props }, ref) {
    const generated = useId();
    const id = given ?? generated;
    return (
      <Frame id={id} label={label} hideLabel={hideLabel} hint={hint} error={error}>
        <textarea
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-message` : undefined}
          className={cn(box(error), "min-h-24 resize-y py-3", className)}
          {...props}
        />
      </Frame>
    );
  },
);
