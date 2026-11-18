-- Leaderboards scan every play in the period, so results are kept in
-- teal_site_cache and recomputed only once they go stale.
local MAX_AGE = { day = 120, week = 300, month = 900, year = 3600, all = 3600 }

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

function handle()
  local period = period_of(params.period, "week")
  local limit = clamp(params.limit, 1, 50, 10)
  local key = "leaderboard:" .. period .. ":" .. limit

  return with_schema(function()
    local cached = db.raw(
      "SELECT value FROM teal_site_cache WHERE key = $1 AND computed_at > $2",
      { key, os.time() - MAX_AGE[period] }
    )[1]
    if cached then
      return json.decode(cached.value)
    end

    local result = compute(period, limit)
    db.raw(
      [[INSERT INTO teal_site_cache (key, value, computed_at) VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, computed_at = EXCLUDED.computed_at]],
      { key, json.encode(result), os.time() }
    )
    return result
  end)
end
