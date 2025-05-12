import * as React from "react";
import { Text as RNText } from "react-native";
import * as Slot from "@rn-primitives/slot";
import type { SlottableTextProps, TextRef } from "@rn-primitives/types";

import { cn } from "../../lib/utils";

const TextClassContext = React.createContext<string | undefined>(undefined);
/// Use sparingly. Meant for setting default font.
const GlobalTextClassContext = React.createContext<string | undefined>(
  undefined,
);

const Text = React.forwardRef<TextRef, SlottableTextProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const textClass = React.useContext(TextClassContext);
    const globalTextClass = React.useContext(GlobalTextClassContext);
    const Component = asChild ? Slot.Text : RNText;
    return (
      <Component
        className={cn(
          globalTextClass,
          "text-base text-foreground web:select-text",
          className,
          textClass,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Text.displayName = "Text";

export { Text, TextClassContext, GlobalTextClassContext };
