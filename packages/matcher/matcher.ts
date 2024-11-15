import { AppleMusicSource } from "./sources/appleMusic";
import { MatcherSource } from "./sources/source";

// songmatcher singleton
class SongMatcher {
  private static instance: SongMatcher;
  // URL prefix for sources
  private static sources: Map<string, MatcherSource> = new Map();
  private constructor() {}

  addSource(source: MatcherSource) {
    // init source
    let base = source.sourceBaseURL;
    for (let i in base) {
      let url = base[i];
      if (!SongMatcher.sources.has(url)) {
        console.log("adding source", url);
        SongMatcher.sources.set(url, source);
      } else {
        throw new Error("Source already inserted!");
      }
    }
  }
  private async initSources() {
    // add sources
    // you can manually add sources, but recommended to put them here
    // if you do not need credentials
    this.addSource(new MatcherSource());
    this.addSource(await AppleMusicSource.getInstance());
  }

  async getSong(url: string) {
    // get source
    console.log(
      "getting song from source",
      url.split("/")[2].replace("www.", ""),
    );
    let source = SongMatcher.sources.get(url.split("/")[2].replace("www.", ""));
    if (!source) {
      throw new Error("No source found for URL!");
    }
    return source.match(url);
  }
  static async getInstance() {
    if (!SongMatcher.instance) {
      SongMatcher.instance = new SongMatcher();
      await SongMatcher.instance.initSources();
    }
    return SongMatcher.instance;
  }
}

export default SongMatcher;
