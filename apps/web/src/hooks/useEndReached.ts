import { useEffect, useRef } from "react";

/**
 * Calls `onEnd` when the returned element nears the viewport, for infinite lists.
 * Put the ref on a sentinel after the last item.
 */
export function useEndReached(onEnd: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(onEnd);
  latest.current = onEnd;
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) latest.current();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);
  return ref;
}
