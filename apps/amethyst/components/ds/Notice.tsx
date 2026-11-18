import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { cn } from "@teal/client/utils";

import { Button } from "./Button";
import { Glass } from "./Glass";
import { Icon } from "./Icon";
import { Heading, Text } from "./Text";

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
    <Glass className={cn("gap-2 p-5", center && "items-center", className)}>
      {icon ? (
        <View className="mb-1 h-12 w-12 items-center justify-center rounded-full bg-tint-soft">
          <Icon icon={icon} size={22} className="text-tint" />
        </View>
      ) : null}
      <Heading level={2} size="card" className={center ? "text-center" : undefined}>
        {title}
      </Heading>
      {body ? <Text className={cn("text-[15px] text-ink-2", center && "text-center")}>{body}</Text> : null}
      {action ? <View className="mt-2">{action}</View> : null}
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
    <View role="alert" className={className}>
      <Notice
        title={title}
        body={body}
        action={onRetry ? <Button label="Try again" variant="secondary" size="sm" onPress={onRetry} /> : null}
      />
    </View>
  );
}

export function Loading({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <View className={cn("items-center justify-center py-16", className)}>
      <ActivityIndicator accessibilityLabel={label} />
    </View>
  );
}
