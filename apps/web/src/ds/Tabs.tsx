import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@teal/client/utils";

import { Icon } from "./Icon";

export type TabItem<T extends string> = { value: T; label: string; count?: number; icon?: LucideIcon };

/** An underlined tab row. Arrow keys, Home, and End move between tabs (WAI-ARIA tabs). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : undefined;
    if (target === undefined) return;
    event.preventDefault();
    onChange(tabs[target].value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[target]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn("flex border-b border-hair", className)}>
      {tabs.map((tab, index) => {
        const on = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKey(event, index)}
            className={cn(
              "flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-1 text-[14px]",
              on ? "border-ink font-bold text-ink" : "border-transparent font-semibold text-ink-2 hover:text-ink",
            )}
          >
            {tab.icon ? <Icon icon={tab.icon} size={17} className={on ? "text-ink" : "text-ink-2"} /> : null}
            <span className="truncate">{tab.label}</span>
            {tab.count !== undefined ? <span className="text-[12px] font-normal tabular-nums text-ink-2">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
