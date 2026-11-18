-- Fixes the track, artists or release on one of the caller's plays, in both
-- play collections when the play has an alpha twin. MusicBrainz IDs stay as
-- they are, except artist IDs, which only survive on artists whose name is kept.
local function trimmed(value)
  if type(value) ~= "string" then return nil end
  value = string.match(value, "^%s*(.-)%s*$")
  if value == "" then return nil end
  return value
end

-- The play lexicons cap these at 256 bytes.
local function too_long(value)
  return value and #value > 256
end

function handle()
  local track = trimmed(input.trackName)
  if not track then return refuse("InvalidRequest", "A play needs a track name.") end
  local release = trimmed(input.releaseName)

  local names = {}
  if type(input.artists) == "table" then
    for _, name in ipairs(input.artists) do
      local artist = trimmed(name)
      if artist then table.insert(names, artist) end
    end
  end
  if #names > 32 then return refuse("InvalidRequest", "That's more than 32 artists.") end
  if too_long(track) or too_long(release) then
    return refuse("InvalidRequest", "Names can be at most 256 characters.")
  end
  for _, name in ipairs(names) do
    if too_long(name) then return refuse("InvalidRequest", "Names can be at most 256 characters.") end
  end

  local plays, refusal = own_plays(input.uri)
  if not plays then return refusal end

  local result
  for _, play in ipairs(plays) do
    local r = play.record
    local ids = {}
    if type(r.artists) == "table" then
      for _, artist in ipairs(r.artists) do
        if type(artist) == "table" and artist.artistName then ids[artist.artistName] = artist.artistMbId end
      end
    end

    local artists = {}
    for _, name in ipairs(names) do
      table.insert(artists, { artistName = name, artistMbId = ids[name] })
    end

    r.trackName = track
    r.releaseName = release
    r.artists = #artists > 0 and artists or nil
    -- The older flat fields would contradict the edit, so they go.
    r.artistNames = nil
    r.artistMbIds = nil
    r:save()

    -- A plain table, since play_of only reads tables.
    index_play(r._uri, caller_did, play.rkey, play.collection, {
      trackName = track, releaseName = release, artists = artists,
      playedTime = r.playedTime, releaseMbId = r.releaseMbId,
    })
    if r._uri == input.uri then result = { uri = r._uri, cid = r._cid } end
  end
  return result or { uri = input.uri }
end
