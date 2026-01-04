import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "bundler-plugin": "src/plugins/bundler-plugin.ts",
    "postcss-plugin": "src/plugins/postcss-plugin.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
});
