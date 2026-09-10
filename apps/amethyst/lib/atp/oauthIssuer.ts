export const DEFAULT_OAUTH_PDS_HOST = "bsky.social";

export function pdsHostFromOAuthIssuer(
  issuer?: string | null,
  fallback = DEFAULT_OAUTH_PDS_HOST,
) {
  if (!issuer) return fallback;

  try {
    const hostname = new URL(issuer).hostname.trim();
    return hostname || fallback;
  } catch {
    return fallback;
  }
}
