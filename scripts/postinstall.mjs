import { spawnSync } from "node:child_process";

if (process.env.CI === "true") {
  console.log("Skipping postinstall lexicon generation in CI.");
  process.exit(0);
}

const result = spawnSync("pnpm", ["lex:gen-server"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
