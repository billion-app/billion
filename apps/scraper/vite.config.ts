import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const workspacePackagePrefix = "@acme/";
const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((module) => `node:${module}`),
]);

function externalizeRuntimeDependency(id: string) {
  if (id.startsWith(workspacePackagePrefix)) return false;

  return (
    nodeBuiltins.has(id) ||
    (!id.startsWith(".") && !id.startsWith("/") && !id.startsWith("\0"))
  );
}

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: "dist",
    rollupOptions: {
      external: externalizeRuntimeDependency,
      input: {
        main: fileURLToPath(new URL("./src/main.ts", import.meta.url)),
        "retroactive-briefs": fileURLToPath(
          new URL("./src/retroactive-briefs.ts", import.meta.url),
        ),
        "retroactive-lenses": fileURLToPath(
          new URL("./src/retroactive-lenses.ts", import.meta.url),
        ),
        "reprocess-content": fileURLToPath(
          new URL("./src/reprocess-content.ts", import.meta.url),
        ),
        "backfill-bill-descriptions": fileURLToPath(
          new URL("./src/backfill-bill-descriptions.ts", import.meta.url),
        ),
        "change-images": fileURLToPath(
          new URL("./src/change-images.ts", import.meta.url),
        ),
        "content-images": fileURLToPath(
          new URL("./src/content-images.ts", import.meta.url),
        ),
        "prune-bills": fileURLToPath(
          new URL("./src/prune-bills.ts", import.meta.url),
        ),
      },
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
        entryFileNames: "[name].js",
      },
    },
    ssr: true,
    target: "node22",
  },
});
