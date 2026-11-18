-- record.index:fm.teal.feed.play and record.index:fm.teal.alpha.feed.play.
-- Copies each play into teal_plays (see prelude.lua) and lets HappyView store
-- the record as usual.

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

function handle()
  if action == "delete" then
    with_schema(function()
      db.raw("DELETE FROM teal_plays WHERE uri = $1", { uri })
    end)
    return true
  end

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
  return true
end
