import { execFileSync } from "node:child_process";
import { join } from "node:path";

it("interoperates with the real ESM SDK and generated profile schema", () => {
  // Jest's library runner is CommonJS; run this boundary in Node so the actual
  // ESM SDK/schema execute together instead of replacing either with a mock.
  expect(() =>
    execFileSync(
      process.execPath,
      [
        require.resolve("tsx/cli"),
        "--test",
        join(__dirname, "../../tests/profileBlob.integration.mts"),
      ],
      { stdio: "pipe" },
    ),
  ).not.toThrow();
});
