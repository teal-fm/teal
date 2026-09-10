# Legacy `play_to_artists` Decision

Decision: `play_to_artists` can be removed by a dedicated database migration after deployments are running code that reads artists from `play_to_artists_extended`.

Current evidence:

- Aqua feed, music, search, and stats repositories read from `play_to_artists_extended`.
- Satellite latest-play reads now use `play_to_artists_extended`.
- Cadet writes new artist links to `play_to_artists_extended`.
- Existing migrations still create and backfill from `play_to_artists`, so historical database setup remains reproducible.
- Cadet still deletes from `play_to_artists` defensively while the legacy table exists.

Removal plan:

1. Deploy the extended-table readers and writers.
2. Add a follow-up migration that drops `play_to_artists` after migration `20241220000003_artists_without_mbids.sql` has copied any legacy data into `play_to_artists_extended`.
3. Remove Cadet's defensive `DELETE FROM play_to_artists` calls in the same change as the drop migration.
4. Refresh SQLx offline metadata against the migrated schema.

Do not drop the table in a mixed-version deployment where older services may still read from or clean up `play_to_artists`.

