/** Read-only bounded review: never invokes a model or writes to a database. */
import { readFile } from "node:fs/promises";

import { officialGuidePayloadSchema } from "../lib/official-guide-cache";
import {
  propositionGuideHash,
  propositionGuideSnapshot,
  publishedPropositionConsequences,
} from "../lib/proposition-consequences";

const [guidePath, number, revisionPath] = process.argv.slice(2);
if (!guidePath || !number || !/^\d+[A-Z]?$/.test(number)) {
  throw new Error(
    "Usage: tsx src/tools/review-proposition.ts GUIDE.json NUMBER [REVISION.json]",
  );
}
const guide = officialGuidePayloadSchema.parse(
  JSON.parse(await readFile(guidePath, "utf8")),
);
const matches = guide.measures.filter((item) => item.number === number);
if (matches.length !== 1)
  throw new Error("Expected one exact proposition number in captured guide");
const measure = matches[0];
if (!measure) throw new Error("Proposition unavailable");
if (!revisionPath) {
  console.log(
    JSON.stringify(
      {
        electionDate: guide.electionDate,
        measure,
        guideHash: propositionGuideHash(guide.electionDate, measure),
        snapshot: propositionGuideSnapshot(guide.electionDate, measure),
      },
      null,
      2,
    ),
  );
} else {
  const revision: unknown = JSON.parse(await readFile(revisionPath, "utf8"));
  const publishable = publishedPropositionConsequences(
    guide.electionDate,
    measure,
    [revision],
  );
  console.log(
    JSON.stringify({ publishable: !!publishable, revision }, null, 2),
  );
  if (!publishable) process.exitCode = 1;
}
