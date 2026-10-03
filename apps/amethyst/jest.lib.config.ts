/**
 * Jest config for pure TypeScript library tests (no React Native / Expo deps).
 * Run: npx jest --config jest.lib.config.ts
 */
import type { Config } from "jest";

const config: Config = {
  testMatch: ["<rootDir>/lib/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          rootDir: ".",
          module: "Node16",
          moduleResolution: "Node16",
          esModuleInterop: true,
          target: "es2020",
          lib: ["es2020", "dom"],
          types: ["jest", "node"],
          strict: true,
          isolatedModules: true,
        },
      },
    ],
  },
  testEnvironment: "node",
};

export default config;
