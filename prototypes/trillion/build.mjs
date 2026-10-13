// Bundle the shared Trillion reader for the HTML mockup, so the mockup and the
// Expo DOM component run the same code. Run after changing the reader:
//   node prototypes/trillion/build.mjs
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const reader = join(here, "../../apps/expo/src/components/trillion/dom");
// esbuild is not a direct dependency; resolve it through the Expo app's tooling.
const require = createRequire(join(here, "../../apps/expo/package.json"));
const { build } = require(
  require.resolve("esbuild", {
    paths: [join(here, "../../node_modules/.pnpm/node_modules")],
  }),
);

await build({
  entryPoints: [join(reader, "reader-engine.js")],
  bundle: true,
  format: "iife",
  globalName: "TrillionReader",
  minify: true,
  outfile: join(here, "reader.bundle.js"),
  absWorkingDir: join(here, "../../apps/expo"),
  nodePaths: [join(here, "../../apps/expo/node_modules")],
  legalComments: "none",
});
copyFileSync(join(reader, "reader.css"), join(here, "reader.css"));
console.log("Built prototypes/trillion/reader.bundle.js and reader.css");
