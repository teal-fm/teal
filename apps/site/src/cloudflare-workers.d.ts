/** The one Workers runtime API the site uses; `wrangler types` would emit the rest. */
declare module "cloudflare:workers" {
  export function waitUntil(promise: Promise<unknown>): void;
}
