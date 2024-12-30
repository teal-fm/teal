## Getting Started

### Prerequisites
- Node (>= v21.0.0)
- Go
- Bun
- Turbo

To get started with this template, simply paste this command into your terminal:

```bash
pnpm install && pnpm install -g turbo && cp apps/aqua/.env.example apps/aqua/.env &&
pnpm run db:migrate
```
Running on a Mac may also require adding @libsql/darwin-x64 dependency

## Development

To start the development server run:

```bash
turbo dev --filter=@teal/aqua
```

Open http://localhost:3000/ with your browser to see the home page. You will need to login with Bluesky to test the posting functionality of the app. Note: if the redirect back to the app after you login isn't working correctly, you may need to replace the `127.0.0.1` with `localhost`.
