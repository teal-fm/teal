import {
  DEFAULT_OAUTH_PDS_HOST,
  pdsHostFromOAuthIssuer,
} from "../atp/oauthIssuer";

describe("OAuth issuer helpers", () => {
  it("uses the issuer hostname as the PDS host", () => {
    expect(pdsHostFromOAuthIssuer("https://evil.gay")).toBe("evil.gay");
  });

  it("falls back when the issuer is missing or invalid", () => {
    expect(pdsHostFromOAuthIssuer(null)).toBe(DEFAULT_OAUTH_PDS_HOST);
    expect(pdsHostFromOAuthIssuer("not a url")).toBe(DEFAULT_OAUTH_PDS_HOST);
  });
});
