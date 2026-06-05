# Stable Development OAuth Tunnel

Use this when ATProto OAuth callback testing needs a stable public HTTPS hostname. Do not commit Cloudflare tunnel tokens or credentials.

Current stable development preview:

```text
https://sigilyph.teal.fm
```

## One-Time Cloudflare Setup

1. Create a named Cloudflare Tunnel in the Cloudflare Zero Trust dashboard.
2. Add a public hostname for the tunnel, for example `sigilyph.teal.fm`.
3. Route that hostname to the service URL `http://amethyst:80`.
4. Copy the generated tunnel token into a local shell or an uncommitted `.env` file as `CLOUDFLARED_TUNNEL_TOKEN`.

## Local Environment

Set the public host values before building Amethyst. These values can live in your ignored `.env` file:

```bash
export TUNNEL_HOST=sigilyph.teal.fm
export CLIENT_ADDRESS=:80
export EXPO_PUBLIC_BASE_URL=https://$TUNNEL_HOST
export EXPO_PUBLIC_AQUA_URL=https://$TUNNEL_HOST
export CLOUDFLARED_TUNNEL_TOKEN=<cloudflare-named-tunnel-token>
```

The Amethyst Caddy image serves the web app and proxies `/xrpc/*` to Aqua, so the same public origin can be used for both `EXPO_PUBLIC_BASE_URL` and `EXPO_PUBLIC_AQUA_URL`.

## Build And Run

```bash
pnpm tunnel:up
```

To stop the preview:

```bash
pnpm tunnel:down
```

To inspect it:

```bash
pnpm tunnel:status
pnpm tunnel:logs
pnpm tunnel:verify
```

Confirm the OAuth client metadata is served from the stable host:

```bash
curl https://$TUNNEL_HOST/client-metadata.json
curl "https://$TUNNEL_HOST/xrpc/fm.teal.alpha.stats.getLatest?limit=1"
```

The metadata must include:

```json
{
  "redirect_uris": ["https://sigilyph.teal.fm/auth/callback"],
  "client_id": "https://sigilyph.teal.fm/client-metadata.json",
  "client_uri": "https://sigilyph.teal.fm"
}
```

## OAuth QA Checklist

- Open `https://$TUNNEL_HOST`.
- Start sign-in with a test ATProto account.
- Confirm the authorization server accepts `https://$TUNNEL_HOST/client-metadata.json`.
- Confirm the callback returns to `https://$TUNNEL_HOST/auth/callback`.
- Confirm the app restores the signed-in session after refresh.
