import { forwardRef, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { cn } from "@/lib/utils";

import { Glass } from "./Glass";
import { Icon } from "./Icon";
import { Text } from "./Text";

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

export type ButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
};

/** A pill button. Wrap in `<Link asChild>` to navigate. */
export const Button = forwardRef<View, ButtonProps>(function Button(
  { label, variant = "primary", size = "md", icon, loading, disabled, className, ...props },
  ref,
) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "flex-row items-center justify-center self-start rounded-full web:transition-opacity active:opacity-70 web:hover:opacity-90 disabled:opacity-50",
        v.box,
        s.box,
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" className={v.text} />
      ) : icon ? (
        <Icon icon={icon} size={s.icon} className={v.text} />
      ) : null}
      <Text className={cn("font-semibold", s.text, v.text)}>{label}</Text>
    </Pressable>
  );
});

/** A round icon-only button. The label is required because there's no visible text. */
export const IconButton = forwardRef<
  View,
  Omit<PressableProps, "children"> & {
    icon: LucideIcon;
    label: string;
    glass?: boolean;
    size?: number;
    tint?: boolean;
    className?: string;
  }
>(function IconButton({ icon, label, glass, size = 40, tint, className, ...props }, ref) {
  const inner = (
    <Icon icon={icon} size={Math.round(size * 0.48)} className={tint ? "text-tint" : "text-ink"} />
  );
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn("rounded-full active:opacity-70 disabled:opacity-40", className)}
      {...props}
    >
      {glass ? (
        <Glass className="items-center justify-center rounded-full" style={{ width: size, height: size }}>
          {inner}
        </Glass>
      ) : (
        <View className="items-center justify-center rounded-full bg-fill" style={{ width: size, height: size }}>
          {inner}
        </View>
      )}
    </Pressable>
  );
});

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
    <View role="group" aria-label={label} className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            aria-pressed={on}
            onPress={() => onChange(option.value)}
            className={cn(
              "items-center justify-center rounded-full active:opacity-70",
              SIZES[size].box,
              on ? "bg-tint" : "border border-hair",
            )}
          >
            <Text className={cn("font-semibold", SIZES[size].text, on ? "text-on-tint" : "text-ink")}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap items-center gap-2.5">{children}</View>;
}
