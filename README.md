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


### Running the full stack in docker for development
_Still a work in progress and may have some hiccups_

#### 1. Set up publicly accessible endpoints. 
It is recommended if you are running aqua to make a publicly accessible endpoint for the app to post to. You can do that a couple of ways:

* Set up the traditional port forward on your router 
* Use a tool like [ngrok](https://ngrok.com/) with the command `ngrok http 8080` or [Cloudflare tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/) (follow the 2a. portion of the guide when you get to that point).

If you do the cloudflare tunnels for amethyst as well,
you will also need
to follow [this](https://caddy.community/t/caddy-with-cloudflare-tunnel/18569) for routing to work properly.
Although you can just run it locally and it will work.

#### 2. Set up .envs
1. copy [.env.template](.env.template) and name it [.env](.env). The docker build will pull everything from this `.env`. There are notes in the [.env.template](.env.template) on what some of the values should be.
2. Follow the instructions in [piper](https://github.com/teal-fm/piper) to set up environment variables for the music scraper. But name it `.env.air`

#### 3. Run docker
1. Make sure docker and docker compose is installed
2. It is recommended to run 'docker compose -f compose.dev.yml pull' to pull the latest remote images before running the docker compose command.
3. Run `docker compose -f compose.dev.yml up -d`


And that's it! You should have the full teal.fm stack running locally. Now if you are working on aqua you can do `docker container stop aqua-app` and run that locally during development while everything else is running in docker.

