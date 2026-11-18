-- Deletes one of the caller's plays, and its alpha twin if it has one, so the
-- twin can't stand in for it on the site.
function handle()
  local plays, refusal = own_plays(input.uri)
  if not plays then return refusal end

  for _, play in ipairs(plays) do
    local uri = play.record._uri
    play.record:delete()
    unindex_play(uri)
  end
  return { success = true }
end
