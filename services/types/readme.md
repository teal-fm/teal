## Types
Rust lexicons for teal.fm and others.

### Generate lexicons
You will need to install [esquema-cli](https://github.com/fatfingers23/esquema) a fork of the [atrium codegen tool](https://github.com/sugyan/atrium).

Currently can install directly from the repo
`cargo install esquema-cli --git https://github.com/fatfingers23/esquema.git`

Then can recreate with `esquema-cli generate local --lexdir ./lexicons --outdir ./src` from this directory
