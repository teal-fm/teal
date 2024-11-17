## Getting Started

To get started with this template, simply paste this command into your terminal:

```bash
bun install && bun install -g turbo && mv apps/aqua/.dev_env apps/aqua/.env &&
bun run db:migrate
```

## Development

To start the development server run:

```bash
turbo dev --filter=@teal/aqua
```

Open http://localhost:3000/oauth/login/:handle with your browser to see the
result.
