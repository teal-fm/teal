import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
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
