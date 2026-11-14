import { forwardRef, useId } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { cn } from "@teal/client/utils";

import { usePlaceholderColor } from "./halo";
import { Text } from "./Text";

export type FieldProps = TextInputProps & {
  label: string;
  /** Hide the visible label when the context already names the field. */
  hideLabel?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
};

/** A labelled text field. Keyboard focus shows a tint border (see global.css). */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, hideLabel, hint, error, multiline, className, ...props },
  ref,
) {
  const id = useId();
  const placeholder = usePlaceholderColor();
  return (
    <View className="gap-1.5">
      {!hideLabel && (
        <Text nativeID={`${id}-label`} className="text-[14px] font-semibold text-ink">
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        aria-labelledby={hideLabel ? undefined : `${id}-label`}
        accessibilityLabel={hideLabel ? label : undefined}
        aria-invalid={error ? true : undefined}
        multiline={multiline}
        placeholderTextColor={placeholder}
        className={cn(
          "rounded-[14px] border bg-fill px-3.5 font-sans text-[16px] text-ink",
          multiline ? "min-h-24 py-3" : "h-12",
          error ? "border-destructive" : "border-hair",
          className,
        )}
        textAlignVertical={multiline ? "top" : "center"}
        {...props}
      />
      {error ? (
        <Text role="alert" className="text-[13px] text-destructive">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-[13px] text-ink-2">{hint}</Text>
      ) : null}
    </View>
  );
});
