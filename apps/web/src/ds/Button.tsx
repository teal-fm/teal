import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@teal/client/utils";

import { Icon } from "./Icon";
import { A } from "./Link";
import { Spinner } from "./Spinner";

const VARIANTS = {
  primary: { box: "bg-tint", text: "text-on-tint" },
  secondary: { box: "bg-fill", text: "text-ink" },
  outline: { box: "border border-hair", text: "text-ink" },
  plain: { box: "", text: "text-tint" },
  destructive: { box: "bg-fill", text: "text-destructive" },
} as const;

const SIZES = {
  md: { box: "h-11 px-5 gap-2", text: "text-[16px]", icon: 18 },
  sm: { box: "h-9 px-3.5 gap-1.5", text: "text-[14px]", icon: 16 },
} as const;

type Look = {
  label: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
};

function buttonClass({ variant = "primary", size = "md", className }: Look) {
  return cn(
    "inline-flex shrink-0 items-center justify-center self-start rounded-full font-semibold whitespace-nowrap transition-[filter,opacity] select-none hover:brightness-95 active:opacity-70 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANTS[variant].box,
    VARIANTS[variant].text,
    SIZES[size].box,
    SIZES[size].text,
    className,
  );
}

function Inner({ label, icon, loading, size = "md" }: Look) {
  return (
    <>
      {loading ? <Spinner className="size-4 text-current" /> : icon ? <Icon icon={icon} size={SIZES[size].icon} className="text-current" /> : null}
      {label}
    </>
  );
}

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & Look & { href?: undefined };
export type LinkButtonProps = Look & { href: string; replace?: boolean; target?: string; "aria-label"?: string };

/** A pill button. Pass `href` to make it a link. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { label, variant, size, icon, loading, className, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ label, variant, size, className })}
      {...props}
    >
      <Inner label={label} icon={icon} loading={loading} size={size} />
    </button>
  );
});

export function LinkButton({ href, replace, target, label, variant, size, icon, className, ...rest }: LinkButtonProps) {
  return (
    <A href={href} replace={replace} target={target} className={buttonClass({ label, variant, size, className })} aria-label={rest["aria-label"]}>
      <Inner label={label} icon={icon} size={size} />
    </A>
  );
}

type IconLook = { icon: LucideIcon; label: string; glass?: boolean; size?: number; tint?: boolean; className?: string };

function iconInner({ icon, glass, size = 40, tint }: IconLook) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full",
        glass ? "border border-glass-edge bg-glass backdrop-blur-2xl backdrop-saturate-150" : "bg-fill",
      )}
      style={{ width: size, height: size }}
    >
      <Icon icon={icon} size={Math.round(size * 0.48)} className={tint ? "text-tint" : "text-ink"} />
    </span>
  );
}

/** A round icon-only button. The label is required because there's no visible text. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & IconLook
>(function IconButton({ icon, label, glass, size, tint, className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn("shrink-0 rounded-full transition-opacity active:opacity-70 disabled:opacity-40", className)}
      {...props}
    >
      {iconInner({ icon, label, glass, size, tint })}
    </button>
  );
});

export function IconLink({ href, ...look }: IconLook & { href: string }) {
  return (
    <A href={href} aria-label={look.label} title={look.label} className={cn("shrink-0 rounded-full active:opacity-70", look.className)}>
      {iconInner(look)}
    </A>
  );
}

/** A row of pills where one is chosen; each announces whether it's pressed. */
export function Choices<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "sm",
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: keyof typeof SIZES;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center rounded-full font-semibold active:opacity-70",
              SIZES[size].box,
              SIZES[size].text,
              on ? "bg-tint text-on-tint" : "border border-hair text-ink hover:bg-fill",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ButtonRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2.5", className)}>{children}</div>;
}
