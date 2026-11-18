function handle()
  local actor = str(params.did)
  if not actor then
    return { error = "InvalidRequest", message = "did is required" }
  end
  local period = period_of(params.period, "month")
  local top = " LIMIT " .. clamp(params.limit, 1, 50, 10)

  return with_schema(function()
    local total = db.raw("SELECT count(*) AS plays FROM teal_plays p WHERE p.did = $1", { actor })[1]

    local args, bind = new_params()
    local mine = " FROM teal_plays p WHERE p.did = " .. bind(actor) .. period_filter(period, bind)

    local plays = db.raw("SELECT count(*) AS plays" .. mine, args)[1]

    local artists = db.raw(
      "SELECT p.artist AS name, count(*) AS plays" .. mine
        .. " AND p.artist IS NOT NULL GROUP BY p.artist ORDER BY plays DESC, p.artist" .. top,
      args
    )

    local tracks = db.raw(
      [[SELECT p.track AS "trackName", p.artist, max(p.release_mbid) AS "releaseMbId", count(*) AS plays]]
        .. mine .. " GROUP BY p.track, p.artist ORDER BY plays DESC, p.track" .. top,
      args
    )

    local releases = db.raw(
      [[SELECT p.release_name AS "releaseName", p.artist, max(p.release_mbid) AS "releaseMbId",
          count(*) AS plays]] .. mine
        .. " AND p.release_name IS NOT NULL GROUP BY p.release_name, p.artist ORDER BY plays DESC, p.release_name" .. top,
      args
    )

    return {
      did = actor,
      period = period,
      totalPlays = total and total.plays or 0,
      plays = plays and plays.plays or 0,
      artists = artists,
      tracks = tracks,
      releases = releases,
    }
  end)
end
