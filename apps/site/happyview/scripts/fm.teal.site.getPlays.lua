-- The cursor is "<played_at>|<rkey>" of the last play on the previous page.
function handle()
  local limit = clamp(params.limit, 1, 100, 30)
  local args, bind = new_params()
  local sql = "SELECT p.uri, p.did, p.rkey, p.played_at, r.record FROM teal_plays p"
    .. " JOIN happyview_records r ON r.uri = p.uri WHERE true" .. period_filter("all", bind)

  local actor = str(params.did)
  if actor then
    sql = sql .. " AND p.did = " .. bind(actor)
  end

  local cursor = str(params.cursor)
  if cursor then
    local played, key = string.match(cursor, "^(.+)|([^|]+)$")
    if played then
      sql = sql .. " AND (p.played_at, p.rkey) < (" .. bind(played) .. ", " .. bind(key) .. ")"
    end
  end

  local rows = with_schema(function()
    return db.raw(sql .. " ORDER BY p.played_at DESC, p.rkey DESC LIMIT " .. limit, args)
  end)

  local plays = {}
  for _, row in ipairs(rows) do
    local play = play_of(row.uri, row.did, row.record)
    play.playedTime = row.played_at
    table.insert(plays, play)
  end

  local last = rows[#rows]
  return {
    plays = toarray(plays),
    cursor = (#rows == limit and last) and (last.played_at .. "|" .. last.rkey) or nil,
  }
end
