# tailwind-randomizer

A webpack+postcss plugin for obfuscating (encoding/randomizing) your tailwindcss classes for security.

## How to use

### Install the plugin

```
npm i tailwind-randomizer
```

## Plugin Setup

`tailwind-randomizer` works in a two way format with webpack and postcss

### Setup webpack plugin

tailwind-randomizer currently only works as a webpack plugin. You can add it to your webpack configuration (`next.config.ts`) as follows:

```ts
/** @type {import('next').NextConfig} */

import { createRequire } from "node:module";
import type { Configuration } from "webpack";
import { NextConfig } from "next";
const require = createRequire(import.meta.url);

const nextConfig: NextConfig = {
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
```

Make sure you are running `dev` and `build` with the `--webpack` flag if you opt into webpack.

### Setup postcss plugin

finally, setup the plugin in postcss-config (`postcss.config.mjs)`) for final obsfuscation of the class names.

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "tailwind-randomizer/postcss-plugin": {},
  },
};

export default config;
```

## License

Licensed under the [MIT license](https://github.com/kafipointers/tailwind-randomizer/blob/main/LICENSE.md).
