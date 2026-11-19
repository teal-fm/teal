-- Fixes the track, artists or release on one of the caller's plays, and what
-- MusicBrainz recording, release and artists it's linked to, in both play
-- collections when the play has an alpha twin. An ID that isn't sent stays as
-- it is (an artist's, only while the artist keeps their name); an empty one
-- unlinks.
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

local UUID = "^" .. string.rep("%x", 8) .. "%-" .. string.rep("%x", 4) .. "%-"
  .. string.rep("%x", 4) .. "%-" .. string.rep("%x", 4) .. "%-" .. string.rep("%x", 12) .. "$"

-- An MBID from the input: nil when it wasn't sent, false to unlink, or
-- "mbid:<uuid>" as the play lexicons write it. Errors with a message when
-- it's neither empty nor an MBID.
local function mbid_input(value, what)
  if value == nil or value == json.null then return nil end
  if type(value) ~= "string" then error(what, 0) end
  value = string.lower(string.match(value, "^%s*(.-)%s*$"))
  if value == "" then return false end
  value = string.gsub(value, "^mbid:", "")
  if not string.match(value, UUID) then error(what, 0) end
  return "mbid:" .. value
end

-- Whether two MBIDs differ, however each is written.
local function differs(a, b)
  local function bare(id) return type(id) == "string" and string.gsub(string.lower(id), "^mbid:", "") or nil end
  return bare(a) ~= bare(b)
end

-- The input's artists: a name and an MBID (as from mbid_input) each. Plain
-- strings are names, as older pages sent them.
local function artists_input(list)
  local artists = {}
  if type(list) ~= "table" then return artists end
  for _, item in ipairs(list) do
    local name, mbid
    if type(item) == "table" then
      name = trimmed(item.name)
      mbid = mbid_input(item.mbid, "An artist's MusicBrainz ID isn't one.")
    else
      name = trimmed(item)
    end
    if name then table.insert(artists, { name = name, mbid = mbid }) end
  end
  return artists
end

function handle()
  local track = trimmed(input.trackName)
  if not track then return refuse("InvalidRequest", "A play needs a track name.") end
  local release = trimmed(input.releaseName)

  local ok, parsed = pcall(function()
    return {
      artists = artists_input(input.artists),
      recording = mbid_input(input.recordingMbId, "That recording ID isn't a MusicBrainz ID."),
      release = mbid_input(input.releaseMbId, "That release ID isn't a MusicBrainz ID."),
    }
  end)
  if not ok then return refuse("InvalidRequest", tostring(parsed)) end
  local names = parsed.artists

  if #names > 32 then return refuse("InvalidRequest", "That's more than 32 artists.") end
  if too_long(track) or too_long(release) then
    return refuse("InvalidRequest", "Names can be at most 256 characters.")
  end
  for _, artist in ipairs(names) do
    if too_long(artist.name) then return refuse("InvalidRequest", "Names can be at most 256 characters.") end
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
    for _, artist in ipairs(names) do
      local id = artist.mbid
      if id == nil then id = ids[artist.name] end
      table.insert(artists, { artistName = artist.name, artistMbId = id or nil })
    end

    -- A track ID names a recording on one release, so it goes when either changes.
    local relinked = false
    if parsed.recording ~= nil then
      local id = parsed.recording or nil
      relinked = relinked or differs(id, r.recordingMbId)
      r.recordingMbId = id
    end
    if parsed.release ~= nil then
      local id = parsed.release or nil
      relinked = relinked or differs(id, r.releaseMbId)
      r.releaseMbId = id
    end
    if relinked then r.trackMbId = nil end

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
