## Types
Rust lexicons for teal.fm and others.

### Generate lexicons
You will need to install [jacquard-lexicon](https://crates.io/crates/jacquard-lexicon) for lexicon code generation.

Install with:
`cargo install jacquard-lexicon`

Then, from this directory, you can run `jacquard-codegen --input ./../../lexicons --output ./src` to manually generate lexicons

Or: run the workspace command `pnpm lex:gen --rust-only` to generate rust lexicons automatically.
