import { resolveRequestBase } from "../teal/api";

describe("resolveRequestBase", () => {
  it("uses the configured base when the page is on the same loopback host", () => {
    expect(resolveRequestBase("http://localhost:8081", "http://localhost:8081")).toBe(
      "http://localhost:8081",
    );
  });

  it("uses the page origin when a loopback base is opened from another host", () => {
    expect(
      resolveRequestBase("http://localhost:8081", "https://tashi.example.ts.net:8081"),
    ).toBe("https://tashi.example.ts.net:8081");
    expect(resolveRequestBase("http://127.0.0.1:3000", "http://192.168.1.20:8081")).toBe(
      "http://192.168.1.20:8081",
    );
  });

  it("keeps a public base wherever the page is served", () => {
    expect(resolveRequestBase("https://api.teal.fm", "https://teal.fm")).toBe(
      "https://api.teal.fm",
    );
  });

  it("falls back to the page origin, or Aqua's port off the web", () => {
    expect(resolveRequestBase("", "https://teal.fm")).toBe("https://teal.fm");
    expect(resolveRequestBase("", undefined)).toBe("http://localhost:3000");
  });
});
