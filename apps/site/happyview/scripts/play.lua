-- record.index:fm.teal.feed.play and record.index:fm.teal.alpha.feed.play.
-- Copies each play into teal_plays (see prelude.lua) and lets HappyView store
-- the record as usual.

function handle()
  if action == "delete" then
    unindex_play(uri)
    return true
  end

  index_play(uri, did, rkey, collection, record)
  return true
end
