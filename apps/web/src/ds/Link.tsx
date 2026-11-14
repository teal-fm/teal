import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { useRouter } from "@tanstack/react-router";

export type AProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; replace?: boolean };

function isExternal(href: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(href) && !href.startsWith("at://");
}

/**
 * A link to any app path, query string included (the shared route helpers build
 * strings like `/:o/music/x?mbid=…`). A plain click navigates in the app; a
 * modified click or a new tab behaves like any link.
 */
export const A = forwardRef<HTMLAnchorElement, AProps>(function A(
  { href, replace, onClick, target, ...props },
  ref,
) {
  const router = useRouter();
  const external = isExternal(href);
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      external ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (target && target !== "_self")
    ) {
      return;
    }
    event.preventDefault();
    void router.navigate({ href, replace });
  };
  return (
    <a
      ref={ref}
      href={href}
      target={target ?? (external ? "_blank" : undefined)}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={handle}
      {...props}
    />
  );
});

/** Navigates to an app path from code. */
export function useGo() {
  const router = useRouter();
  return (href: string, options?: { replace?: boolean }) => router.navigate({ href, replace: options?.replace });
}
