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

local function play_of(uri, did, record)
  if type(record) == "string" then record = json.decode(record) end
  if type(record) ~= "table" then record = {} end
  return {
    uri = uri,
    did = did,
    trackName = str(record.trackName) or "Untitled",
    artists = artists_of(record),
    releaseName = str(record.releaseName),
    releaseMbId = str(record.releaseMbId),
    recordingMbId = str(record.recordingMbId),
    duration = type(record.duration) == "number" and math.floor(record.duration) or nil,
    playedTime = str(record.playedTime),
    originUrl = str(record.originUri) or str(record.originUrl),
    musicService = str(record.musicServiceUri) or str(record.musicServiceBaseDomain),
    client = str(record.submissionClientAgent),
  }
end
