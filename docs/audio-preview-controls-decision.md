# Album Preview Controls Decision

Decision: do not add album-cover preview controls yet.

Rationale:

- Teal does not currently expose a real audio preview URL in the play, track, album, or MusicBrainz-derived views.
- Cover Art Archive provides artwork, not playable audio previews.
- Adding visible playback controls without a real preview source would create a misleading or disabled UI path.

Requirements before adding controls:

1. A real preview source on track or album data, such as an authorized streaming preview URL or a first-party preview endpoint.
2. Defined playback behavior for web and native targets.
3. Error, loading, unavailable, pause/resume, and accessibility states.
4. Product copy that distinguishes preview playback from full-track playback.

