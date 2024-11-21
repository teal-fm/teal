## Getting Started

### Prerequisites
- Go
- Bun
- Turbo

To get started with this template, simply paste this command into your terminal:

```bash
bun install && bun install -g turbo && cp apps/aqua/.env.example apps/aqua/.env &&
bun run db:migrate
```
Running on an Apple Silicon Mac also requires adding @libsql/darwin-x64 dependency

## Development

To start the development server run:

```bash
turbo dev --filter=@teal/aqua
```

Open http://localhost:3000/ with your browser to see the home page.
