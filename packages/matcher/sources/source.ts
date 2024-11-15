export class MatcherResponse {
  source: string;
  title: string;
  artist: string;
  album: string;
  url: string;
}

// a base class to extend off of ala traits
export class MatcherSource {
  sourceName: string;
  sourceBaseURL: string[];
  constructor() {
    this.sourceName = "Example Source";
    this.sourceBaseURL = ["youtube.com", "youtu.be"];
    console.log(
      "Example source initialized - Will only match with Never Gonna Give You Up",
    );
  }

  getBaseURL(): string[] {
    return this.sourceBaseURL;
  }

  // Match a song given a URL to the source
  async match(url: string): Promise<MatcherResponse | null> {
    if (url === "https://www.youtube.com/watch?v=dQw4w9WgXcQ") {
      return {
        source: this.sourceName,
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
        album: "Never Gonna Give You Up",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      };
    } else {
      return null;
    }
  }
}
