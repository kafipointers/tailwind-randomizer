/** @type {import('next').NextConfig} */

import { createRequire } from "node:module";
import type { Configuration } from "webpack";
const require = createRequire(import.meta.url);

const nextConfig = {
  webpack(config: Configuration) {
    config.module?.rules?.unshift({
      test: /\.(tsx|ts|jsx|js|mjs)$/,
      exclude: /node_modules/,
      enforce: "pre",
      use: [
        {
          loader: require.resolve("tailwind-randomizer/bundler-plugin"),
          options: {},
        },
      ],
    });

    return config;
  },
};

export default nextConfig;
