# Popfeed Sync Decision

Decision: keep Popfeed writes in authenticated Amethyst user flows for now; do not add Cadet or another background writer for Popfeed records yet.

Rationale:

- Popfeed list and list-item records are written to the listener's PDS, so Teal needs the listener's delegated authorization to create them.
- Cadet's role is public Jetstream/CAR ingestion into Teal's index. It does not hold per-user OAuth sessions or refresh tokens.
- A background worker without user-bound credentials would either be unable to write Popfeed records or would require storing long-lived user authorization server-side.
- Amethyst already has the opt-in setting, manual scrobble sync, and signed-in recent-play backfill path needed for user-authorized writes.
- Keeping Popfeed writes client-initiated avoids surprising users by publishing external review/list records from passive ingestion.

Revisit background sync only after Teal has all of:

1. A product decision that users expect future non-manual ingestion to publish Popfeed list items automatically.
2. A server-side delegated OAuth/session storage design with revocation and failure handling.
3. A queue/retry policy that remains idempotent against existing Popfeed list items.
4. A way to surface background sync status and failures back to the listener.
