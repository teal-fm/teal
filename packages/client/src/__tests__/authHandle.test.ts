import { normalizeAuthHandle } from "../authHandle";

describe("authentication identity", () => {
  it("accepts a pasted @handle with surrounding whitespace", () => {
    expect(normalizeAuthHandle("  @alice.bsky.social\n")).toBe(
      "alice.bsky.social",
    );
  });
  it("preserves DID identities and handles without a prefix", () => {
    expect(normalizeAuthHandle(" did:plc:abc ")).toBe("did:plc:abc");
    expect(normalizeAuthHandle("alice.example.com")).toBe("alice.example.com");
  });
  it("does not treat only a prefix as an account", () => {
    expect(normalizeAuthHandle(" @ ")).toBe("");
  });
});
