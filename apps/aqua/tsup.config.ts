import { defineConfig } from "tsup";

export default defineConfig({
  format: ["cjs"],
  entry: ["./src/index.ts"],
  dts: false,
  shims: true,
  skipNodeModulesBundle: false,
  clean: true,
  minify: false,
  bundle: true,
  // https://github.com/egoist/tsup/issues/619
  noExternal: [/(.*)/, "@teal/db", "@teal/lexicons"],
  splitting: false,
});
