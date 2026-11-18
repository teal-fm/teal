-- Leaderboards scan every play in the period (all time takes seconds at
-- millions of plays), so they're served from teal_site_cache however old,
-- marked `stale` past MAX_AGE. A stale answer prompts the site to call again
-- with refresh=true in the background, and that call rebuilds the board.
-- Only a board that was never built is computed while someone waits.
local MAX_AGE = { day = 120, week = 300, month = 3600, year = 3600, all = 3600 }

-- One rebuild per board at a time; a rebuild that dies frees it after this.
local LOCK_SECONDS = 300

local function compute(period, limit)
  local args, bind = new_params()
  local plays = " FROM teal_plays p WHERE true" .. period_filter(period, bind)
  local top = " LIMIT " .. limit

  local totals = db.raw("SELECT count(*) AS plays, count(DISTINCT p.did) AS listeners" .. plays, args)[1] or {}

  local listeners = db.raw(
    "SELECT p.did, count(*) AS plays" .. plays .. " GROUP BY p.did ORDER BY plays DESC, p.did" .. top,
    args
  )

  local artists = db.raw(
    "SELECT p.artist AS name, count(*) AS plays, count(DISTINCT p.did) AS listeners" .. plays
      .. " AND p.artist IS NOT NULL GROUP BY p.artist ORDER BY plays DESC, p.artist" .. top,
    args
  )

  local tracks = db.raw(
    [[SELECT p.track AS "trackName", p.artist, max(p.release_mbid) AS "releaseMbId",
        count(*) AS plays, count(DISTINCT p.did) AS listeners]] .. plays
      .. " GROUP BY p.track, p.artist ORDER BY plays DESC, p.track" .. top,
    args
  )

  return {
    period = period,
    plays = totals.plays or 0,
    listenerCount = totals.listeners or 0,
    listeners = listeners,
    artists = artists,
    tracks = tracks,
    computedAt = now(),
  }
end

local function save(key, result)
  db.raw(
    [[INSERT INTO teal_site_cache (key, value, computed_at) VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, computed_at = EXCLUDED.computed_at]],
    { key, json.encode(result), os.time() }
  )
end

-- True when this request takes the board's rebuild lock.
local function claim(key)
  local now_s = os.time()
  return db.raw(
    [[INSERT INTO teal_site_cache (key, value, computed_at) VALUES ($1, '', $2)
      ON CONFLICT (key) DO UPDATE SET computed_at = EXCLUDED.computed_at
      WHERE teal_site_cache.computed_at < $3
      RETURNING key]],
    { "lock:" .. key, now_s, now_s - LOCK_SECONDS }
  )[1] ~= nil
end

local function release(key)
  db.raw("DELETE FROM teal_site_cache WHERE key = $1", { "lock:" .. key })
end

function handle()
  local period = period_of(params.period, "week")
  local limit = clamp(params.limit, 1, 50, 10)
  local key = "leaderboard:" .. period .. ":" .. limit
  local refresh = params.refresh == true or params.refresh == "true" or params.refresh == "1"

  return with_schema(function()
    local cached = db.raw(
      "SELECT value, computed_at FROM teal_site_cache WHERE key = $1",
      { key }
    )[1]
    if cached then
      local stale = (tonumber(cached.computed_at) or 0) < os.time() - MAX_AGE[period]
      if not (stale and refresh and claim(key)) then
        local result = json.decode(cached.value)
        result.stale = stale
        return result
      end
    end

    local ok, result = pcall(compute, period, limit)
    if cached then release(key) end
    if not ok then error(result, 0) end
    save(key, result)
    result.stale = false
    return result
  end)
end
