# Stable Development OAuth Tunnel

Use this when ATProto OAuth callback testing needs a stable public HTTPS hostname. Do not commit Cloudflare tunnel tokens or credentials.

## One-Time Cloudflare Setup

1. Create a named Cloudflare Tunnel in the Cloudflare Zero Trust dashboard.
2. Add a public hostname for the tunnel, for example `teal-dev.example.com`.
3. Route that hostname to the service URL `http://amethyst:80`.
4. Copy the generated tunnel token into a local shell or an uncommitted `.env` file as `CLOUDFLARED_TUNNEL_TOKEN`.

## Local Environment

Set the public host values before building Amethyst:

```bash
export TUNNEL_HOST=teal-dev.example.com
export CLIENT_ADDRESS=:80
export EXPO_PUBLIC_BASE_URL=https://$TUNNEL_HOST
export EXPO_PUBLIC_AQUA_URL=https://$TUNNEL_HOST
export CLOUDFLARED_TUNNEL_TOKEN=<cloudflare-named-tunnel-token>
```

The Amethyst Caddy image serves the web app and proxies `/xrpc/*` to Aqua, so the same public origin can be used for both `EXPO_PUBLIC_BASE_URL` and `EXPO_PUBLIC_AQUA_URL`.

## Build And Run

```bash
docker compose -f compose.dev.yml --profile named-tunnel build amethyst
docker compose -f compose.dev.yml --profile named-tunnel up amethyst aqua-api cadet postgres garnet cloudflared-named
```

Confirm the OAuth client metadata is served from the stable host:

```bash
curl https://$TUNNEL_HOST/client-metadata.json
```

The metadata must include:

```json
{
  "redirect_uris": ["https://teal-dev.example.com/auth/callback"],
  "client_id": "https://teal-dev.example.com/client-metadata.json",
  "client_uri": "https://teal-dev.example.com"
}
```

## OAuth QA Checklist

- Open `https://$TUNNEL_HOST`.
- Start sign-in with a test ATProto account.
- Confirm the authorization server accepts `https://$TUNNEL_HOST/client-metadata.json`.
- Confirm the callback returns to `https://$TUNNEL_HOST/auth/callback`.
- Confirm the app restores the signed-in session after refresh.

