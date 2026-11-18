/**
 * A native app's OAuth redirect scheme: its client_id host, reversed, as the
 * AT Protocol OAuth profile requires (`sigilyph.teal.fm` → `fm.teal.sigilyph`).
 * The iOS app derives the same scheme in OAuth.swift.
 */
export function nativeCallbackScheme(origin: string) {
  return new URL(origin).hostname.split(".").reverse().join(".");
}

/** Where a native app's authorization server redirects after sign-in. */
export function nativeRedirectUri(origin: string) {
  return `${nativeCallbackScheme(origin)}:/oauth/callback`;
}
