import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
    globals: true,
    environment: "node",
    maxConcurrency: 1,
    isolate: false,
    setupFiles: ["./test/setup.ts"],
    sequence: {
      shuffle: false,
    },
  },
});
