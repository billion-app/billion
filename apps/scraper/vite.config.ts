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
        "retroactive-lenses": fileURLToPath(
          new URL("./src/retroactive-lenses.ts", import.meta.url),
        ),
        "reprocess-content": fileURLToPath(
          new URL("./src/reprocess-content.ts", import.meta.url),
        ),
        "retroactive-videos": fileURLToPath(
          new URL("./src/retroactive-videos.ts", import.meta.url),
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
