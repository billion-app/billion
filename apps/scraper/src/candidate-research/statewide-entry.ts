import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { collectLieutenantGovernor } from "./statewide.js";

const output = process.argv[2];
if (!output || process.argv.length !== 3)
  throw new Error(
    "Usage: tsx src/candidate-research/statewide-entry.ts /path/to/draft.json (source collection only; no database writes)",
  );
const document = await collectLieutenantGovernor();
await writeFile(resolve(output), JSON.stringify(document, null, 2) + "\n");
console.log(
  JSON.stringify({
    output: resolve(output),
    candidates: document.manifest.members.map((member) => member.name),
    sources: document.sources.length,
    policyVersion: document.manifest.policyVersion,
    finance: "missing; official California search linked",
  }),
);
