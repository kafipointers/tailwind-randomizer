import fs from "fs";
import path from "path";
import type { Root, Rule, PluginCreator } from "postcss";

const MAP_FILE = path.join(process.cwd(), ".next/class-map.json");

function toTailwindSelector(className: string) {
  return className
    .split("")
    .map((ch) => {
      if (/^[a-zA-Z0-9_-]$/.test(ch)) return ch;
      return "\\" + ch;
    })
    .join("");
}

const postcssPlugin: PluginCreator<Record<string, never>> = () => {
  return {
    postcssPlugin: "tailwind-class-rewrite",
    Once(root: Root) {
      console.log("🧩 Tailwind Class Rewriter Plugin Initialized");

      if (!fs.existsSync(MAP_FILE)) return;

      const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));

      console.log("🧩 Tailwind Replacer Class Map:", Object.keys(map).length);

      root.walkRules((rule: Rule) => {
        const original = rule.selector;

        let rewritten = original;

        for (const [orig, obf] of Object.entries(map)) {
          const tw = "." + toTailwindSelector(orig);
          const target = "." + obf;

          if (rewritten === tw) {
            rewritten = rewritten.split(tw).join(target);
          }
        }

        if (rewritten !== original) {
          rule.selector = rewritten;
        }
      });
    },
  };
};

postcssPlugin.postcss = true;

export default postcssPlugin;
