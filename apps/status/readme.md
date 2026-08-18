# Teal Status API

This service is a Rust XRPC API and Jetstream v2 consumer for listening status records. It folds both status namespaces into the existing `statii` table and maintains its own DID-to-handle index and Jetstream cursor.

```text
GET /xrpc/fm.teal.actor.getStatus?actor=did:plc:...
GET /xrpc/fm.teal.actor.getStatus?actor=alice.example
```

The `actor` query parameter accepts a DID, an AT Protocol handle, an `@`-prefixed handle, or an `at://` handle. Stable and legacy alpha status records are both subscribed to and canonicalized into the `statii` table.

Active responses contain `isListening: true` and the status record's `item` as `status`. Missing and expired statuses contain `isListening: false` and a human-readable `message`.

The service listens on `STATUS_API_PORT` (default `3002`) and uses `DATABASE_URL`. It consumes `JETSTREAM_URL` (default `wss://jetstream.us-east.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents`) with a persisted cursor. Handles are resolved from the service's Jetstream identity index, existing indexed profiles, then `STATUS_HANDLE_RESOLVER` (default `https://public.api.bsky.app`).

To backfill both status collections from Jetstream Replay, set `JETSTREAM_API_KEY` and run `cargo run -p status-api -- backfill`. The command folds creates, updates, and deletes through the archive, saves the replay tip for the live consumer, and removes expired or superseded status records.
