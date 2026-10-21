import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { loadRepoEnv } from "@acme/env/load";

const options = await yargs(hideBin(process.argv))
  .strict()
  .option("limit", {
    type: "number",
    demandOption: true,
    description: "Maximum existing images to inspect (1-1000)",
  })
  .option("target", {
    choices: ["local", "production"] as const,
    demandOption: true,
    description: "Expected database and Storage target",
  })
  .option("apply", {
    type: "boolean",
    default: false,
    description: "Upload resized artwork and update matching metadata",
  })
  .check((argv) => {
    if (
      !Number.isSafeInteger(argv.limit) ||
      argv.limit < 1 ||
      argv.limit > 1000
    ) {
      throw new Error("--limit must be an integer between 1 and 1000");
    }
    return true;
  })
  .help()
  .parseAsync();

loadRepoEnv();
const { resizeContentImages } = await import("./resize-content-images.js");
await resizeContentImages(options);
