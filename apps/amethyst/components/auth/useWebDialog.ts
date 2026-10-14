import { useEffect, useRef } from "react";
import { Platform, type View } from "react-native";
import { usePathname } from "expo-router";

const FOCUSABLE =
  'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

/** Native navigation handles modal focus; web needs containment and restoration. */
export function useWebDialog(
  onClose: () => void,
  titleId: string,
  path: string,
) {
  const dialogRef = useRef<View>(null);
  const isFocused = usePathname() === path;
  useEffect(() => {
    if (Platform.OS !== "web" || !isFocused) return;
    const dialog = dialogRef.current as unknown as HTMLElement | null;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.tabIndex = -1;
    const elements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-disabled") !== "true" &&
          element.getClientRects().length > 0,
      );
    const frame = requestAnimationFrame(() => {
      (
        dialog.querySelector<HTMLElement>("input") ||
        elements()[0] ||
        dialog
      ).focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const items = elements();
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) {
          event.preventDefault();
          dialog.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            !dialog.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !dialog.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node))
        (elements()[0] || dialog).focus();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose, titleId, isFocused]);
  return dialogRef;
}
