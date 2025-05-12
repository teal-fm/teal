# Contributing

Hi, thanks for showing interest in our project, we appreciate you wanting to be
a part of it!

> ###### Do you accept external contributions?
>
> Yes, we welcome external contributions! The only request we have is that you
> check with us before working on a large feature, as we'd prefer to avoid duplicating effort.
>
> You can do this by either creating an issue that we can communicate through, or
> popping into the Discord channel and asking in the #development channel.
> Whatever works best for you!
>
> Other than that, feel free to contribute however you'd like!

Fork, then clone the repo:

    git clone git@github.com:your-username/teal.git

Set up your machine:

```bash
pnpm install && pnpm install -g turbo && cp apps/aqua/.env.example apps/aqua/.env &&
pnpm run db:migrate
```

## Development

To start the monorepo run:

```bash
turbo dev
```

If you only want to start one service run:

```bash
turbo dev --filter=<service_path>
```

Open http://localhost:3000/ with your browser to see the home page. You will need
to login with Bluesky to test the posting functionality of the app. Note: if the
redirect back to the app after you login isn't working correctly, you may need to
replace the `127.0.0.1` with `localhost`.

Push to your fork and [submit a pull request][pr].

[pr]: https://github.com/teal-fm/teal/compare/

Now you're waiting on us! We'll try to comment on the pull request as soon as
we can!

Thanks again!
