/**
 * `value` when it is an http(s) URL, otherwise undefined. Record fields such as
 * a play's originUri come from anyone's repository, so a link opened from one
 * must not be a `javascript:`, `intent:`, `tel:`, or other app scheme.
 */
export function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined;

  try {
    const { protocol } = new URL(value);

    return protocol === "http:" || protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}
