import SongMatcher from "./matcher";
import log from "./log";

log.info("Starting matcher");

const matcher = await SongMatcher.getInstance();

const song = await matcher.getSong(
  "https://music.apple.com/us/album/never-gonna-give-you-up/1559885420?i=1559885421",
);

log.info("Got song" + song);
