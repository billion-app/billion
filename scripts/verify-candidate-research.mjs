import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "https://www.billion-news.app" },
    name: { type: "string" },
    office: { type: "string" },
    out: { type: "string" },
  },
});
assert.ok(
  values.name && values.office,
  "Provide --name and --office for a real guide candidate",
);
const base = new URL(values["base-url"]);
assert.ok(
  !base.username && !base.password,
  "API URL must not contain credentials",
);

async function query(procedure, input) {
  const url = new URL(`/api/trpc/${procedure}`, base);
  url.searchParams.set("input", JSON.stringify({ json: input }));
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  assert.ok(response.ok, `${procedure} returned HTTP ${response.status}`);
  const body = await response.json();
  assert.ok(body.result?.data, `${procedure} returned no public result`);
  return body.result.data.json;
}

const resolution = await query("candidateBriefs.forGuideCandidate", {
  name: values.name,
  officeSlug: values.office,
  language: "en",
});
assert.equal(
  resolution.status,
  "published",
  "Real candidate research is not published",
);
const race = await query("candidateBriefs.race", {
  releaseId: resolution.releaseId,
  language: "en",
});
assert.ok(race, "The candidate's public race is unavailable");
assert.equal(race.manifest.id, resolution.releaseId);
assert.ok(
  Date.parse(race.manifest.expiresAt) > Date.now(),
  "Public research expired",
);
assert.equal(race.manifest.contestId, resolution.identity.contestId);
assert.equal(race.manifest.electionDate, resolution.identity.electionDate);
assert.equal(race.manifest.jurisdiction, resolution.identity.jurisdiction);
assert.deepEqual(
  race.manifest.members.map((member) => member.candidateId).sort(),
  race.briefs.map((brief) => brief.identity.candidateId).sort(),
  "Comparison must include the entire released race",
);
const member = race.manifest.members.find(
  (candidate) => candidate.candidateId === resolution.identity.candidateId,
);
assert.ok(member, "Resolved candidate is missing from the certified roster");
const brief = race.briefs.find(
  (candidate) => candidate.identity.candidateId === member.candidateId,
);
assert.ok(brief?.research, "The real candidate has no rich research body");
assert.ok(
  brief.research.promises.length,
  "The real candidate has no researched promise",
);
assert.ok(brief.evidence.length, "The real candidate has no cited sources");
const evidenceIds = new Set(brief.evidence.map((source) => source.id));
for (const section of brief.sections)
  for (const claim of section.claims)
    assert.ok(
      claim.evidenceIds.every((id) => evidenceIds.has(id)),
      "A displayed claim has an unresolved source",
    );
assert.ok(
  brief.research.finance || brief.research.financeGap,
  "Finance must contain verified data or an explicit coverage gap",
);
const catalog = await query("candidateBriefs.listRaces", { language: "en" });
assert.ok(
  catalog.some((item) => item.id === resolution.releaseId),
  "The released race is missing from public discovery",
);
const result = {
  verifiedAt: new Date().toISOString(),
  api: base.origin,
  candidate: member.name,
  identity: resolution.identity,
  releaseId: resolution.releaseId,
  reviewedAt: race.reviewedAt,
  expiresAt: race.manifest.expiresAt,
  candidates: race.manifest.members.map((candidate) => candidate.name),
  promises: brief.research.promises.length,
  sources: brief.evidence.length,
  finance: brief.research.finance ? "available" : "explicitly unavailable",
};
if (values.out)
  await writeFile(values.out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
