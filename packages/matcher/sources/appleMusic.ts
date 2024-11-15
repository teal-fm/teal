import { MatcherResponse, MatcherSource } from "./source";

export class AppleMusicSource extends MatcherSource {
  private static instance: AppleMusicSource;
  private token: AppleMusicToken;

  private constructor() {
    super();
    this.sourceName = "Apple Music";
    this.sourceBaseURL = ["music.apple.com"];
  }

  public static async getInstance(): Promise<AppleMusicSource> {
    if (!AppleMusicSource.instance) {
      AppleMusicSource.instance = new AppleMusicSource();
      await AppleMusicSource.instance.init();
    }
    return AppleMusicSource.instance;
  }

  private async init() {
    this.token = await AppleMusicToken.getInstance();
  }

  async match(url: string): Promise<MatcherResponse | null> {
    try {
      // Extract ID from Apple Music URL
      // check if it's a song with the i param
      const songId = this.extractSongId(url);
      if (!songId) return null;

      // Call Apple Music API
      console.log("Fetching song info from Apple Music API");
      const bearer = await this.token.get();
      const response = await fetch(
        `https://amp-api.music.apple.com/v1/catalog/us/songs/${songId}`,
        {
          headers: {
            Authorization: `Bearer ${bearer}`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
            Host: "amp-api.music.apple.com",
            Origin: "https://music.apple.com",
            //"Music-User-Token": "MUSIC_USER_TOKEN", // Optional: needed for user-specific actions
          },
        },
      );

      if (!response.ok) {
        console.error("Error fetching song info from Apple Music API");
        console.log(response);
        return null;
      }

      const data = await response.json();
      const track = data.data[0].attributes;

      return {
        source: this.sourceName,
        title: track.name,
        artist: track.artistName,
        album: track.albumName,
        url: url,
      };
    } catch (error) {
      console.error("Error matching Apple Music track:", error);
      return null;
    }
  }

  private extractSongId(url: string): string | null | Error {
    try {
      const urlObj = new URL(url);
      if (!this.sourceBaseURL.includes(urlObj.hostname)) return null;

      let matches = urlObj.searchParams.get("i");
      return matches ? matches : new Error("No song ID found");
    } catch {
      return null;
    }
  }
}

interface Storefronts {
  data: Array<{
    id: string;
    attributes: {
      default_language_tag: string;
    };
  }>;
}

// token factory
export class AppleMusicToken {
  static AMTInstance: AppleMusicToken;
  bearerToken: string;
  bearerExpiry: Date;

  private constructor() {}

  static async getInstance() {
    if (!this.AMTInstance) {
      this.AMTInstance = new AppleMusicToken();
      await this.AMTInstance.init();
    }
    return this.AMTInstance;
  }

  private async init() {
    this.bearerToken = await this.getBearerToken();
    // set expiry to 2 months from now
    this.bearerExpiry = new Date(Date.now() + 12096e5);
  }

  async get() {
    // check expiry
    if (this.bearerExpiry < new Date() || !this.bearerToken) {
      // expired, get new token
      this.bearerToken = await this.getBearerToken();
    }
    return this.bearerToken;
  }

  async getBearerToken(): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json;charset=utf-8",
      Connection: "keep-alive",
      Accept: "application/json",
      Origin: "https://music.apple.com",
      Referer: "https://music.apple.com/",
      "Accept-Encoding": "gzip, deflate, br",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    };

    const mainPageResponse = await fetch("https://music.apple.com/us/browse", {
      headers,
    });
    if (!mainPageResponse.ok)
      throw new Error("Failed to send request to Apple Music");

    const mainPageCode = await mainPageResponse.text();
    const jsSearchRe = /index(.*?)\.js/;
    const jsSearch = jsSearchRe.exec(mainPageCode);
    if (!jsSearch) throw new Error("Failed to find js file");

    const jsFile = jsSearch[0];

    const jsFilePageResponse = await fetch(
      `https://music.apple.com/assets/${jsFile}`,
      { headers },
    );
    if (!jsFilePageResponse.ok)
      throw new Error("Failed to send request to Apple Music");

    const jsFileCode = await jsFilePageResponse.text();
    const jwtSearchRe = /"(?<key>eyJh(.*?))"/;
    const jwtSearch = jwtSearchRe.exec(jsFileCode);
    if (!jwtSearch || !jwtSearch.groups) throw new Error("Failed to find jwt");

    const jwt = jwtSearch.groups.key;

    return jwt;
  }
}
