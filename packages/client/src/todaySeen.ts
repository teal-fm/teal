import { useCallback, useEffect, useState } from "react";
import { clientConfig } from "./config";

const KEY = "teal-today-seen";

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Today collapses once you've seen it. Scrolling past it marks it seen for the day;
 * the next visit that day opens collapsed. `collapsed` is this visit's state.
 */
export function useTodaySeen() {
  const [collapsed, setCollapsed] = useState(false);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    clientConfig().storage.getItem(KEY)
      .then((day) => {
        if (day === localDay()) {
          setCollapsed(true);
          setMarked(true);
        }
      })
      .catch(() => undefined);
  }, []);

  const markSeen = useCallback(() => {
    if (marked) return;
    setMarked(true);
    clientConfig().storage.setItem(KEY, localDay()).catch(() => undefined);
  }, [marked]);

  const collapse = useCallback(() => {
    setCollapsed(true);
    markSeen();
  }, [markSeen]);

  return { collapsed, collapse, expand: () => setCollapsed(false), markSeen };
}
