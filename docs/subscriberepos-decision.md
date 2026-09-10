# `subscribeRepos` CBOR Adapter Decision

Decision: do not add a `com.atproto.sync.subscribeRepos` CBOR adapter yet.

Rationale:

- Cadet's active ingestion path is Jetstream.
- The current Teal collections are consumed through Jetstream filters.
- CAR import remains available as the backfill path.
- Adding relay-level CBOR firehose support now would introduce another streaming protocol and decoding path without a current operational need.

Add `subscribeRepos` support only if Teal needs relay-level firehose sync that Jetstream cannot provide, such as repository operations outside Jetstream availability, relay-specific replay requirements, or collection coverage that requires raw sync events.

