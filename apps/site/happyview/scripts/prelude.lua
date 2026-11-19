-- Shared helpers. sync.ts prepends this file to every script, because
-- HappyView's sandbox has no `require`. Every query here is Postgres SQL.

-- HappyView keeps each record as JSON text, which is too slow to aggregate
-- across millions of plays. The record script copies the few fields the site
-- needs into teal_plays as plays are indexed, one row per (did, rkey): an
-- account that moved off the alpha namespace often holds the same play in
-- both collections under the same rkey, and the stable copy wins.
local SCHEMA = {
  [[CREATE TABLE IF NOT EXISTS teal_plays (
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    uri TEXT NOT NULL,
    stable BOOLEAN NOT NULL,
    played_at TEXT COLLATE "C" NOT NULL,
    track TEXT NOT NULL,
    artist TEXT,
    release_name TEXT,
    release_mbid TEXT,
    PRIMARY KEY (did, rkey)
  )]],
  "CREATE INDEX IF NOT EXISTS teal_plays_played ON teal_plays (played_at DESC, rkey DESC)",
  "CREATE INDEX IF NOT EXISTS teal_plays_did_played ON teal_plays (did, played_at DESC, rkey DESC)",
  "CREATE INDEX IF NOT EXISTS teal_plays_uri ON teal_plays (uri)",
  -- Leaderboards, recomputed once they go stale.
  [[CREATE TABLE IF NOT EXISTS teal_site_cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    computed_at BIGINT NOT NULL
  )]],
}

-- Runs fn, creating the site's tables first if fn failed for want of them.
-- Concurrent first runs can race on CREATE, hence the pcalls.
local function with_schema(fn)
  local ok, result = pcall(fn)
  if ok then return result end
  if not string.find(tostring(result), "teal_", 1, true) then error(result, 0) end
  for _, statement in ipairs(SCHEMA) do
    pcall(db.raw, statement)
  end
  return fn()
end

local PERIODS = { day = 86400, week = 604800, month = 2592000, year = 31536000 }

local function clamp(value, low, high, default)
  local n = math.floor(tonumber(value) or default)
  if n < low then return low end
  if n > high then return high end
  return n
end

local function period_of(value, default)
  if value == "all" or PERIODS[value] then return value end
  return default
end

-- played_at is always "YYYY-MM-DDTHH:MM:SSZ", so it sorts and compares as text.
local function iso(t)
  return os.date("!%Y-%m-%dT%H:%M:%SZ", t)
end

-- Positional parameters for db.raw: bind(v) appends v and returns its "$n".
local function new_params()
  local params = {}
  return params, function(value)
    table.insert(params, value)
    return "$" .. #params
  end
end

-- Plays stamped in the future are clock mistakes, so every period stops at now.
local function period_filter(period, bind)
  local now = os.time()
  local sql = " AND p.played_at <= " .. bind(iso(now + 600))
  local span = PERIODS[period]
  if span then
    sql = sql .. " AND p.played_at >= " .. bind(iso(now - span))
  end
  return sql
end

local function str(value)
  if type(value) == "string" and value ~= "" then return value end
  return nil
end

local function artists_of(record)
  local names = {}
  if type(record.artists) == "table" then
    for _, artist in ipairs(record.artists) do
      local name = type(artist) == "table" and str(artist.artistName or artist.name)
      if name then table.insert(names, name) end
    end
  end
  if #names == 0 and type(record.artistNames) == "table" then
    for _, name in ipairs(record.artistNames) do
      if str(name) then table.insert(names, name) end
    end
  end
  return toarray(names)
end

-- Each artist's MusicBrainz ID, aligned with artists_of ("" where there's
-- none); nil when no artist has one.
local function artist_ids_of(record)
  local ids, any = {}, false
  local function add(id)
    id = str(id) or ""
    if id ~= "" then any = true end
    table.insert(ids, id)
  end
  if type(record.artists) == "table" then
    for _, artist in ipairs(record.artists) do
      if type(artist) == "table" and str(artist.artistName or artist.name) then
        add(artist.artistMbId or artist.mbid)
      end
    end
  end
  if #ids == 0 and type(record.artistNames) == "table" then
    local legacy = type(record.artistMbIds) == "table" and record.artistMbIds or {}
    for i, name in ipairs(record.artistNames) do
      if str(name) then add(legacy[i]) end
    end
  end
  if not any then return nil end
  return toarray(ids)
end

local function play_of(uri, did, record)
  if type(record) == "string" then record = json.decode(record) end
  if type(record) ~= "table" then record = {} end
  return {
    uri = uri,
    did = did,
    trackName = str(record.trackName) or "Untitled",
    artists = artists_of(record),
    artistMbIds = artist_ids_of(record),
    releaseName = str(record.releaseName),
    releaseMbId = str(record.releaseMbId),
    recordingMbId = str(record.recordingMbId),
    isrc = str(record.isrc),
    duration = type(record.duration) == "number" and math.floor(record.duration) or nil,
    playedTime = str(record.playedTime),
    originUrl = str(record.originUri) or str(record.originUrl),
    musicService = str(record.musicServiceUri) or str(record.musicServiceBaseDomain),
    client = str(record.submissionClientAgent),
  }
end

-- Play times ---------------------------------------------------------------

local TID_ALPHABET = "234567abcdefghijklmnopqrstuvwxyz"

-- A TID rkey encodes when the record was written, in microseconds.
local function tid_time(key)
  if type(key) ~= "string" or #key ~= 13 then return nil end
  local n = 0
  for i = 1, 13 do
    local digit = string.find(TID_ALPHABET, string.sub(key, i, i), 1, true)
    if not digit then return nil end
    n = n * 32 + (digit - 1)
  end
  return (n >> 10) // 1000000
end

-- Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's algorithm).
local function days_from_civil(y, m, d)
  if m <= 2 then y = y - 1 end
  local era = y // 400
  local yoe = y - era * 400
  local doy = (153 * (m > 2 and m - 3 or m + 9) + 2) // 5 + d - 1
  return era * 146097 + yoe * 365 + yoe // 4 - yoe // 100 + doy - 719468
end

-- Unix seconds from playedTime, which clients write as ISO 8601 (with or
-- without a zone, which then means UTC) and occasionally as a Unix number.
local function parse_time(value)
  local n = tonumber(value)
  if n then
    if n > 1e11 then n = n / 1000 end
    if n > 946684800 and n < 4102444800 then return math.floor(n) end
    return nil
  end
  if type(value) ~= "string" then return nil end

  local y, mo, d, h, mi, s, rest =
    string.match(value, "^(%d%d%d%d)%-(%d%d)%-(%d%d)[Tt ](%d%d):(%d%d):?(%d*)(.*)$")
  if not y then return nil end
  y, mo, d, h, mi, s = tonumber(y), tonumber(mo), tonumber(d), tonumber(h), tonumber(mi), tonumber(s) or 0
  if y < 2000 or y > 2100 or mo < 1 or mo > 12 or d < 1 or d > 31 or h > 23 or mi > 59 or s > 60 then
    return nil
  end

  local t = days_from_civil(y, mo, d) * 86400 + h * 3600 + mi * 60 + s
  local sign, oh, om = string.match(rest, "([+-])(%d%d):?(%d%d)%s*$")
  if sign then
    local offset = tonumber(oh) * 3600 + tonumber(om) * 60
    t = sign == "+" and t - offset or t + offset
  end
  return t
end

-- Index maintenance ---------------------------------------------------------

local PLAY_COLLECTIONS = { ["fm.teal.feed.play"] = true, ["fm.teal.alpha.feed.play"] = true }

-- Copies one play into teal_plays. Called by the record script as plays are
-- indexed and by the edit procedure, so an edit shows without waiting for the
-- firehose to echo it back.
local function index_play(uri, did, rkey, collection, record)
  local play = play_of(uri, did, record)
  local played = parse_time(record and record.playedTime) or tid_time(rkey) or os.time()
  -- db.raw parameters are a Lua sequence, so absent values travel as "" and
  -- NULLIF turns them back into NULL. Booleans arrive as integers.
  with_schema(function()
    db.raw([[
      INSERT INTO teal_plays (did, rkey, uri, stable, played_at, track, artist, release_name, release_mbid)
      VALUES ($1, $2, $3, $4::integer = 1, $5, $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''))
      ON CONFLICT (did, rkey) DO UPDATE SET
        uri = EXCLUDED.uri, stable = EXCLUDED.stable, played_at = EXCLUDED.played_at,
        track = EXCLUDED.track, artist = EXCLUDED.artist,
        release_name = EXCLUDED.release_name, release_mbid = EXCLUDED.release_mbid
      WHERE teal_plays.uri = EXCLUDED.uri OR EXCLUDED.stable
    ]], {
      did, rkey, uri, collection == "fm.teal.feed.play" and 1 or 0, iso(played), play.trackName,
      play.artists[1] or "", play.releaseName or "", play.releaseMbId or "",
    })
  end)
end

local function unindex_play(uri)
  with_schema(function()
    db.raw("DELETE FROM teal_plays WHERE uri = $1", { uri })
  end)
end

-- Procedures answer expected failures with { error, message } rather than
-- error(), which HappyView turns into a bare 500.
local function refuse(code, message)
  return { error = code, message = message }
end

-- The caller's play at uri and its twin in the other play collection (same
-- rkey), whichever exist; or nil and a refusal unless uri is the caller's play.
local function own_plays(uri)
  local owner, coll, key = string.match(str(uri) or "", "^at://([^/]+)/([^/]+)/([^/]+)$")
  if not owner or not PLAY_COLLECTIONS[coll] then
    return nil, refuse("InvalidRequest", "That isn't a play.")
  end
  if not caller_did or owner ~= caller_did then
    return nil, refuse("Forbidden", "You can only change your own plays.")
  end

  local found = {}
  for other in pairs(PLAY_COLLECTIONS) do
    local r = Record.load("at://" .. owner .. "/" .. other .. "/" .. key)
    if r then table.insert(found, { record = r, collection = other, rkey = key }) end
  end
  if #found == 0 then return nil, refuse("NotFound", "That play no longer exists.") end
  return found
end
