import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

import pkg from "./package.json" with { type: "json" };

function gitCommit() {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_COMMIT__: JSON.stringify(gitCommit()),
  },
  resolve: { tsconfigPaths: true },
  server: {
    // Caddy (pnpm dev) and the Cloudflare tunnel reach this server by other names.
    allowedHosts: true,
    // Aqua is on the same origin in production; in a bare `vite dev`, proxy it too.
    proxy: { "/xrpc": process.env.AQUA_URL || "http://localhost:3000" },
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
