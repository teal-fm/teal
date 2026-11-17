import { nativeCallbackScheme, nativeRedirectUri } from "../atp/nativeOAuth";

it("reverses the origin's host into the native redirect scheme", () => {
  expect(nativeCallbackScheme("https://sigilyph.teal.fm")).toBe("fm.teal.sigilyph");
  expect(nativeRedirectUri("https://teal.fm")).toBe("fm.teal:/oauth/callback");
});
