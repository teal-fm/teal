import type { ReactNode } from "react";

export function Card({
  title,
  badge,
  action,
  children,
}: {
  title: string;
  /** Sits beside the title, such as a live indicator. */
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-neutral-400/20 bg-gray-100/50 p-4 backdrop-blur-sm dark:bg-gray-900/50 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-lg font-semibold">{title}</h3>
          {badge}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-neutral-500 dark:text-teal-100/50">
      {children}
    </p>
  );
}
