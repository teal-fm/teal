aqua but RIIR

this submodule is structured like this:

- api: non-xrpc api definitions
- xrpc: xrpc api definitions
- repos: our data repositories

things to keep in mind:
- data is intentionally separated from the api
- using the db crate is discouraged, instead use/add 'repo' modules to interact with the db abstractly

adding new repos:
- 1. create the repo module in the repos folder
- 2. add the repo to the long type in repos/mod.rs
```rs
pub trait DataSource: ActorProfileRepo + ... + Send + Sync {
...
}
