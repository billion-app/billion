/** Read-only review artifact validation. Never approves, generates, fetches or persists. */
import { readFile } from "node:fs/promises";

import { propositionContextSchema } from "@acme/validators";

import { officialGuidePayloadSchema } from "../lib/official-guide-cache";
import {
  propositionGuideHash,
  propositionGuideSnapshot,
} from "../lib/proposition-consequences";
import {
  contextContentHash,
  publishedPropositionContext,
  validateContextEvidence,
} from "../lib/proposition-context";

const [guidePath, revisionPath] = process.argv.slice(2);
if (!guidePath || !revisionPath)
  throw new Error(
    "Usage: tsx src/tools/review-proposition-context.ts GUIDE.json REVISION.json",
  );
const guide = officialGuidePayloadSchema.parse(
  JSON.parse(await readFile(guidePath, "utf8")),
);
const revision = propositionContextSchema.parse(
  JSON.parse(await readFile(revisionPath, "utf8")),
);
const matches = guide.measures.filter(
  (item) => item.number === revision.number,
);
const measure = matches.length === 1 ? matches[0] : undefined;
const matching =
  !!measure &&
  revision.electionDate === guide.electionDate &&
  revision.officialTitle === measure.title &&
  revision.officialUrl === measure.sourceUrl &&
  revision.guideHash === propositionGuideHash(guide.electionDate, measure) &&
  revision.sources.some(
    (source) =>
      source.url === measure.sourceUrl &&
      source.snapshot === propositionGuideSnapshot(guide.electionDate, measure),
  );
const valid = matching && validateContextEvidence(revision);
console.log(
  JSON.stringify(
    {
      validEvidence: valid,
      contentHash: contextContentHash(revision),
      reviewState: revision.review.state,
      publishable:
        !!measure &&
        !!publishedPropositionContext(
          guide.electionDate,
          measure,
          [revision],
          revision.sources,
        ),
    },
    null,
    2,
  ),
);
if (!valid) process.exitCode = 1;
