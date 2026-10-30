import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const identityFields = [
  "candidateId",
  "contestId",
  "jurisdiction",
  "electionDate",
];
const key = (identity) =>
  identityFields.map((field) => identity?.[field] ?? "").join("\u0000");
const sameIdentity = (a, b) => key(a) === key(b);
const nonempty = (value) =>
  typeof value === "string" && value.trim().length > 0;
const validUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export function expectedRoster(document) {
  const electionDate = document.electionDate;
  assert.match(electionDate, /^\d{4}-\d{2}-\d{2}$/);
  const candidates = document.races
    ? document.races.flatMap((race) =>
        race.members.map((member) => ({
          ...member,
          officeFamily: race.officeFamily,
          identity: member.identity,
        })),
      )
    : (document.members ?? []).map((member) => {
        const code = member.contestId.split(":").at(-1);
        const districtType = { 11: "cd", 12: "sldu", 13: "sldl" }[
          code.slice(0, 2)
        ];
        return {
          ...member,
          identity: member.identity ?? {
            candidateId: member.candidateId,
            contestId: member.contestId,
            electionDate,
            jurisdiction:
              member.jurisdiction ??
              `ocd-division/country:us/state:ca${districtType ? `/${districtType}:${Number(code.slice(6, 8))}` : ""}`,
          },
        };
      });
  assert.ok(candidates.length, "Expected roster is empty");
  for (const candidate of candidates) {
    assert.ok(
      identityFields.every((field) => nonempty(candidate.identity?.[field])),
      "Expected roster has incomplete identity",
    );
    assert.equal(candidate.identity.electionDate, electionDate);
  }
  assert.equal(
    new Set(candidates.map((candidate) => key(candidate.identity))).size,
    candidates.length,
    "Expected roster contains duplicate identities",
  );
  return {
    electionDate,
    candidates,
    scope: document.scopeLabel ?? document.scope,
    scopeKind: document.scope,
    snapshotId: document.id,
    localCoverage: document.localCoverage,
    localCrosswalk: document.localCrosswalk,
    localPrimary: document.localPrimary,
    races: document.races,
    additionalSources: document.additionalSources,
    historicalSources: document.historicalSources,
    sourceUrl: document.source?.url ?? document.sourceUrl,
  };
}

const hash = (text) => createHash("sha256").update(text).digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, child]) => `${JSON.stringify(name)}:${canonical(child)}`)
      .join(",")}}`;
  return JSON.stringify(value);
};

export function finalScopeErrors(roster, now = Date.now()) {
  const errors = [];
  const coverage = roster.localCoverage;
  if (roster.scopeKind !== "ca_sos_certified_and_san_jose")
    errors.push(
      "Final scope requires an authoritative combined state and San Jose snapshot",
    );
  if (coverage?.scope !== "san_jose" || coverage.status !== "verified")
    errors.push("San Jose local territorial coverage is not verified complete");
  if (coverage?.pendingRaces !== 0 || coverage?.pendingCandidates !== 0)
    errors.push(
      "San Jose pending races and unresolved candidate identities must explicitly be zero",
    );
  const races = (roster.races ?? []).filter(
    (race) => race.officeFamily === "local",
  );
  const localCandidates = roster.candidates.filter(
    (candidate) => !candidate.identity.candidateId.startsWith("ca-sos:"),
  );
  if (
    !races.length ||
    coverage?.expectedRaces !== races.length ||
    coverage?.expectedCandidates !== localCandidates.length ||
    !localCandidates.length
  )
    errors.push(
      "San Jose verified expected counts do not match the complete local roster",
    );
  if (
    races.reduce((count, race) => count + race.members.length, 0) !==
    localCandidates.length
  )
    errors.push("Local identities are not all accounted for by local contests");
  const crosswalk = roster.localCrosswalk;
  const entries = crosswalk?.entries ?? [];
  if (
    crosswalk?.schemaVersion !== 1 ||
    crosswalk.electionDate !== roster.electionDate ||
    entries.length !== 129 ||
    new Set(entries.map((entry) => entry.sourceContestId)).size !== 129
  )
    errors.push(
      "San Jose scope ledger must account for all 129 official county contests",
    );
  if (
    entries.some(
      (entry) => !["include", "exclude", "off_ballot"].includes(entry.status),
    )
  )
    errors.push(
      "San Jose scope ledger contains pending or unresolved contests",
    );
  const sources = [
    ...(roster.additionalSources ?? []),
    ...(roster.historicalSources ?? []),
  ];
  const archived = (proof) =>
    validUrl(proof?.url) &&
    sources.some(
      (source) =>
        source.url === proof.url &&
        source.contentHash === proof.contentHash &&
        typeof source.text === "string" &&
        hash(source.text) === proof.contentHash,
    );
  const reviewValid = (document) => {
    if (!document?.review) return false;
    const { review, ...body } = document;
    return (
      nonempty(review.actorId) &&
      Date.parse(review.reviewedAt) <= now &&
      review.digest === hash(canonical(body))
    );
  };
  if (!reviewValid(crosswalk))
    errors.push("San Jose territorial crosswalk lacks a valid reviewed digest");
  if (
    !sources.some(
      (source) =>
        source.contentHash === crosswalk?.rosterSourceHash &&
        typeof source.text === "string" &&
        hash(source.text) === source.contentHash,
    )
  )
    errors.push("San Jose crosswalk lacks its authoritative source archive");
  for (const entry of entries) {
    if (
      !nonempty(entry.reason) ||
      !entry.proofs?.length ||
      !entry.proofs.every(archived)
    )
      errors.push(
        `Scope contest ${entry.sourceContestId} lacks archived territorial proof`,
      );
    if (entry.status === "include") {
      const matching = races.filter(
        (race) =>
          race.sourceContestId === entry.sourceContestId &&
          race.jurisdiction === entry.jurisdiction,
      );
      if (matching.length !== 1)
        errors.push(
          `Included San Jose contest ${entry.sourceContestId} is missing or duplicated`,
        );
    }
  }
  for (const race of races) {
    if (
      !entries.some(
        (entry) =>
          entry.status === "include" &&
          entry.sourceContestId === race.sourceContestId &&
          entry.jurisdiction === race.jurisdiction,
      )
    )
      errors.push(
        `Local contest ${race.contestId} is outside verified San Jose scope`,
      );
    if (
      !archived(race.sourceProof) ||
      race.members.some((member) => !archived(member.sourceProof))
    )
      errors.push(
        `Local contest ${race.contestId} has unresolved source identities`,
      );
  }
  if (roster.localPrimary) {
    const primary = roster.localPrimary;
    const identities = primary.identityCrosswalk;
    if (
      primary.kind !== "scc_clarity" ||
      !reviewValid(identities) ||
      identities?.electionDate !== roster.electionDate
    )
      errors.push(
        "Current local identity crosswalk lacks a valid reviewed digest",
      );
    const definition = sources.find(
      (source) => source.url === primary.definitionURL,
    );
    const version = sources.find(
      (source) => source.url === primary.currentVersionURL,
    );
    const settings = sources.find(
      (source) => source.url === primary.settingsURL,
    );
    if (
      !definition ||
      !version ||
      !settings ||
      ![definition, version, settings].every(archived) ||
      identities?.definitionHash !== definition?.contentHash ||
      crosswalk?.rosterSourceHash !== definition?.contentHash
    )
      errors.push(
        "Local current primary source archives and identity crosswalk disagree",
      );
    const mapped = identities?.members ?? [];
    for (const race of races) {
      const matching = mapped.filter(
        (member) => member.sourceContestId === race.sourceContestId,
      );
      if (
        matching.length !== race.members.length ||
        new Set(
          matching.map(
            (member) =>
              `${member.clarityContestKey}:${member.clarityChoiceIndex}`,
          ),
        ).size !== matching.length ||
        race.members.some(
          (member) =>
            matching.filter(
              (item) =>
                item.name === member.name &&
                race.contestId.endsWith(`:${item.clarityContestKey}`) &&
                ["on_ballot", "qualified_write_in"].includes(item.status),
            ).length !== 1,
        )
      )
        errors.push(
          `Local contest ${race.contestId} contains unresolved identity mappings`,
        );
    }
  }
  return errors;
}

export async function walkCatalog(query, electionDate, limit = 100) {
  const items = [],
    cursors = new Set(),
    identities = new Set();
  let cursor, snapshotId, totalMatches, coverage, scopeLabel, families;
  for (let page = 0; page < 10_000; page++) {
    const result = await query("catalog", {
      electionDate,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    assert.ok(
      result && Array.isArray(result.items),
      "Catalog has no items array",
    );
    assert.ok(nonempty(result.snapshotId), "Catalog has no roster snapshot");
    assert.ok(
      Number.isInteger(result.totalMatches) && result.totalMatches >= 0,
      "Invalid catalog total",
    );
    if (page === 0)
      ({ snapshotId, totalMatches, coverage, scopeLabel, families } = result);
    assert.equal(
      result.snapshotId,
      snapshotId,
      "Catalog changed snapshot while paginating",
    );
    assert.equal(
      result.totalMatches,
      totalMatches,
      "Catalog total changed while paginating",
    );
    assert.deepEqual(
      result.coverage,
      coverage,
      "Catalog coverage changed while paginating",
    );
    assert.ok(result.items.length <= limit, "Catalog ignored page limit");
    for (const item of result.items) {
      assert.ok(
        identityFields.every((field) => nonempty(item.identity?.[field])),
        "Catalog item has incomplete identity",
      );
      const id = key(item.identity);
      assert.ok(
        !identities.has(id),
        `Duplicate catalog identity ${item.identity.candidateId}`,
      );
      identities.add(id);
      items.push(item);
    }
    assert.ok(items.length <= totalMatches, "Catalog exceeds reported total");
    if (result.nextCursor == null) {
      assert.equal(
        items.length,
        totalMatches,
        "Catalog truncated before reported total",
      );
      return {
        items,
        snapshotId,
        totalMatches,
        coverage,
        scopeLabel,
        families,
        pages: page + 1,
      };
    }
    assert.ok(
      result.items.length > 0,
      "Catalog cursor continued from an empty page",
    );
    assert.ok(
      nonempty(result.nextCursor) && !cursors.has(result.nextCursor),
      "Catalog cursor cycle",
    );
    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error("Catalog exceeded 10000 pages");
}

function references(value, path = "") {
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      references(item, `${path}[${index}]`),
    );
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([field, child]) =>
    field === "evidenceIds" || field === "filingEvidenceIds"
      ? Array.isArray(child) && child.length
        ? child.map((id) => ({ id, path: `${path}.${field}` }))
        : [{ id: null, path: `${path}.${field}` }]
      : references(child, `${path}.${field}`),
  );
}

export function checkRace(race, expected, { now, snapshotId, policyVersion }) {
  const issues = [],
    briefs = [];
  const manifest = race?.manifest;
  if (
    !manifest ||
    !Array.isArray(manifest.members) ||
    !Array.isArray(race.briefs)
  )
    return { issues: ["Race missing manifest, members or briefs"], briefs };
  const members = manifest.members;
  const expectedIds = expected.map((item) => item.identity.candidateId).sort();
  const memberIds = members.map((item) => item.candidateId).sort();
  if (JSON.stringify(memberIds) !== JSON.stringify(expectedIds))
    issues.push("Race roster differs from entire authoritative contest");
  if (
    new Set(members.map((member) => member.revisionId)).size !== members.length
  )
    issues.push("Race contains duplicate revisions");
  if (race.briefs.length !== members.length)
    issues.push("Race brief/member count mismatch");
  if (!nonempty(manifest.policyVersion) || manifest.policyVersion === "pending")
    issues.push("Publication policy is absent or pending");
  if (policyVersion && manifest.policyVersion !== policyVersion)
    issues.push("Publication policy differs from required current policy");
  if (manifest.rosterSnapshotId && manifest.rosterSnapshotId !== snapshotId)
    issues.push("Release belongs to a different roster snapshot");
  if (
    !validUrl(manifest.rosterSourceUrl) ||
    !nonempty(manifest.rosterHash) ||
    !nonempty(manifest.rosterVerifiedBy)
  )
    issues.push("Missing roster provenance");
  if (!(Date.parse(manifest.expiresAt) > now))
    issues.push("Release expired or has invalid expiry");
  for (const field of ["sourceCheckedAt", "rosterVerifiedAt"])
    if (!(Date.parse(manifest[field]) <= now))
      issues.push(`Invalid or future ${field}`);
  if (
    !(
      Date.parse(manifest.expiresAt) - Date.parse(manifest.sourceCheckedAt) <=
      86_400_000
    )
  )
    issues.push("Source freshness exceeds 24 hours");
  if (!(Date.parse(race.reviewedAt) <= now))
    issues.push("Invalid or future review date");
  for (const brief of race.briefs) {
    const errors = [],
      identity = brief.identity;
    const member = members.find(
      (item) => item.candidateId === identity?.candidateId,
    );
    if (!member || member.revisionId !== brief.revisionId)
      errors.push("Brief/member revision mismatch");
    if (
      race.briefs.filter((item) => sameIdentity(item.identity, identity))
        .length !== 1
    )
      errors.push("Duplicate brief identity");
    if (!expected.some((item) => sameIdentity(item.identity, identity)))
      errors.push("Brief absent from authoritative contest");
    for (const field of ["contestId", "jurisdiction", "electionDate"])
      if (identity?.[field] !== manifest[field])
        errors.push(`Brief/manifest ${field} mismatch`);
    const evidence = brief.evidence ?? [],
      ids = new Set(evidence.map((source) => source.id));
    if (!evidence.length || evidence.length !== ids.size)
      errors.push("Missing or duplicate sources");
    for (const source of evidence) {
      if (
        !validUrl(source.url) ||
        !["publisher", "locator", "contentHash", "excerpt"].every((field) =>
          nonempty(source[field]),
        ) ||
        !(Date.parse(source.retrievedAt) <= now)
      )
        errors.push(`Incomplete or future source ${source.id}`);
      if (
        manifest.currentHashes?.[
          JSON.stringify([
            JSON.stringify([
              identity.jurisdiction,
              identity.electionDate,
              identity.contestId,
              identity.candidateId,
            ]),
            source.id,
          ])
        ] !== source.contentHash
      )
        errors.push(`Evidence hash not current for ${source.id}`);
    }
    const refs = references({
      research: brief.research,
      sections: brief.sections,
    });
    if (!refs.length) errors.push("Research has no source references");
    for (const ref of refs)
      if (!ids.has(ref.id))
        errors.push(`Unresolved reference ${ref.id} at ${ref.path}`);
    const research = brief.research,
      sections = brief.sections ?? [];
    if (!research || !Array.isArray(research.promises))
      errors.push("Missing structured research");
    if (!sections.length) errors.push("Missing research sections");
    const substantive = sections
      .filter((section) => section.topic !== "unknowns")
      .flatMap((section) => section.claims ?? []);
    const nonRosterSources = evidence.filter(
      (source) =>
        source.url !== manifest.rosterSourceUrl &&
        !/C26GG\.txt/i.test(source.url),
    );
    if (!nonRosterSources.length)
      errors.push("Roster-only evidence is not candidate research");
    if (
      !substantive.some(
        (claim) =>
          nonempty(claim.text) &&
          claim.evidenceIds?.some((id) =>
            nonRosterSources.some((source) => source.id === id),
          ),
      )
    )
      errors.push("No substantive claim cites research beyond the roster");
    const judicial =
      expected.some(
        (item) =>
          item.identity.candidateId === identity?.candidateId &&
          item.officeFamily === "judicial_retention",
      ) || /^ca-sos:[^:]+:(14|15)/.test(identity?.candidateId ?? "");
    if (
      judicial &&
      !sections.some(
        (section) =>
          ["record", "mechanisms"].includes(section.topic) &&
          section.claims?.some((claim) => claim.evidenceIds?.length),
      )
    )
      errors.push("Judicial record or authority lacks cited research");
    const quality = brief.researchQuality ?? research?.quality;
    if (
      quality &&
      !["rich", "substantive", "complete"].includes(
        typeof quality === "string" ? quality : quality.classification,
      )
    )
      errors.push("Research quality classified below substantive");
    if (!research?.finance && !nonempty(research?.financeGap))
      errors.push("Finance unavailable without explicit coverage gap");
    if (
      research?.finance &&
      (!nonempty(research.finance.coverageNote) ||
        !research.finance.filingEvidenceIds?.length)
    )
      errors.push("Finance totals lack filing evidence or coverage note");
    briefs.push({
      identity,
      revisionId: brief.revisionId,
      sourceCount: evidence.length,
      researchQuality: quality ?? "independent structural checks only",
      finance: research?.finance ? "available" : "explicit gap",
      errors,
    });
  }
  for (const member of members)
    if (
      !race.briefs.some(
        (brief) =>
          brief.identity?.candidateId === member.candidateId &&
          brief.revisionId === member.revisionId,
      )
    )
      issues.push(`Member has no matching brief ${member.candidateId}`);
  return {
    releaseId: manifest.id,
    policyVersion: manifest.policyVersion,
    issues,
    briefs,
  };
}

async function mapBounded(items, concurrency, action) {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index++];
        await action(item);
      }
    }),
  );
}

async function main() {
  const { values } = parseArgs({
    options: {
      "base-url": { type: "string", default: "https://www.billion-news.app" },
      "expected-roster": { type: "string" },
      "state-only": { type: "boolean", default: false },
      "policy-version": { type: "string" },
      out: { type: "string" },
      concurrency: { type: "string", default: "4" },
      "timeout-ms": { type: "string", default: "30000" },
    },
  });
  assert.ok(
    values["expected-roster"],
    "--expected-roster is required. Use an independently collected official roster, never an API catalog export.",
  );
  const base = new URL(values["base-url"]);
  assert.ok(
    validUrl(base.href) && !base.username && !base.password,
    "Invalid API URL",
  );
  const concurrency = Number(values.concurrency),
    timeout = Number(values["timeout-ms"]);
  assert.ok(
    Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 16,
    "Concurrency must be 1..16",
  );
  assert.ok(
    Number.isInteger(timeout) && timeout >= 100 && timeout <= 120000,
    "Timeout must be 100..120000ms",
  );
  const roster = expectedRoster(
    JSON.parse(await readFile(values["expected-roster"], "utf8")),
  );
  const errors = [],
    resolutions = [],
    races = [];
  const result = {
    checkedAt: new Date().toISOString(),
    api: base.origin,
    scope: values["state-only"]
      ? "State-certified baseline only. San Jose local coverage is not verified."
      : "State-certified candidates and San Jose-serving local contests",
    expectedSource: {
      path: values["expected-roster"],
      sourceUrl: roster.sourceUrl,
      scope: roster.scope,
    },
    errors,
    missing: [],
    extra: [],
    unavailable: [],
    invalid: [],
    resolutions,
    races,
    passed: false,
  };
  const expected = new Map(
    roster.candidates.map((candidate) => [key(candidate.identity), candidate]),
  );
  const localCount = roster.candidates.filter(
    (candidate) => !candidate.identity.candidateId.startsWith("ca-sos:"),
  ).length;
  const stateCount = roster.candidates.length - localCount;
  if (stateCount !== 388)
    errors.push(
      `Expected 388 state-certified candidates; roster has ${stateCount}`,
    );
  if (!values["state-only"])
    errors.push(...finalScopeErrors(roster, Date.parse(result.checkedAt)));
  result.localScope = {
    coverage: roster.localCoverage ?? null,
    crosswalkReview: roster.localCrosswalk?.review ?? null,
    finalScopeVerified: !finalScopeErrors(roster, Date.parse(result.checkedAt))
      .length,
  };
  async function query(procedure, input) {
    const url = new URL(`/api/trpc/candidateBriefs.${procedure}`, base);
    url.searchParams.set("input", JSON.stringify({ json: input }));
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      headers: { accept: "application/json" },
    });
    assert.ok(response.ok, `${procedure} returned HTTP ${response.status}`);
    const envelope = await response.json();
    assert.ok(
      envelope.result?.data && Object.hasOwn(envelope.result.data, "json"),
      `${procedure} returned invalid tRPC envelope`,
    );
    return envelope.result.data.json;
  }
  let catalog;
  try {
    catalog = await walkCatalog(query, roster.electionDate);
    result.catalog = catalog;
  } catch (error) {
    errors.push(error.message);
  }
  const publicItems = new Map(
    (catalog?.items ?? []).map((item) => [key(item.identity), item]),
  );
  result.missing = catalog
    ? roster.candidates.filter(
        (candidate) => !publicItems.has(key(candidate.identity)),
      )
    : [];
  result.unverified = catalog ? [] : roster.candidates;
  result.extra = [...publicItems.values()].filter(
    (item) => !expected.has(key(item.identity)),
  );
  if (result.missing.length)
    errors.push(
      `${result.missing.length} expected candidates missing from catalog`,
    );
  if (result.extra.length)
    errors.push(`${result.extra.length} unexpected catalog identities`);
  if (catalog) {
    if (roster.snapshotId && catalog.snapshotId !== roster.snapshotId)
      errors.push(
        "Public catalog snapshot differs from the authoritative expected snapshot",
      );
    if (!values["state-only"]) {
      const local = catalog.coverage?.localCoverage;
      if (
        local?.scope !== "san_jose" ||
        local.status !== "verified" ||
        local.pendingRaces !== 0 ||
        local.pendingCandidates !== 0 ||
        local.expectedRaces !== roster.localCoverage?.expectedRaces ||
        local.expectedCandidates !== roster.localCoverage?.expectedCandidates
      )
        errors.push(
          "Public catalog does not report the verified complete San Jose scope",
        );
    }
    if (
      !validUrl(catalog.coverage?.sourceUrl) ||
      !nonempty(catalog.coverage?.sourceName) ||
      !(
        Date.parse(catalog.coverage?.fetchedAt) <= Date.parse(result.checkedAt)
      ) ||
      catalog.coverage?.electionDate !== roster.electionDate
    )
      errors.push("Catalog lacks current authoritative source metadata");
    if (
      catalog.coverage?.publishedCandidates !==
      catalog.items.filter((item) => item.status === "published").length
    )
      errors.push("Reported published count differs from enumerated catalog");
    if (catalog.coverage?.expectedCandidates !== expected.size)
      errors.push(
        "Reported coverage differs from authoritative candidate count",
      );
    const contestCount = new Set(
      roster.candidates.map((candidate) => candidate.identity.contestId),
    ).size;
    if (catalog.coverage?.expectedRaces !== contestCount)
      errors.push("Reported coverage differs from authoritative contest count");
  }
  const releases = new Map();
  await mapBounded(
    catalog ? roster.candidates : [],
    concurrency,
    async (candidate) => {
      const identity = candidate.identity;
      try {
        const resolution = await query("forCandidate", {
          identity,
          language: "en",
        });
        const item = publicItems.get(key(identity));
        const issues = [];
        if (resolution?.status !== "published") {
          result.unavailable.push({
            identity,
            name: candidate.name,
            reason: resolution?.reason ?? "null response",
          });
        } else {
          if (!sameIdentity(resolution.identity, identity))
            issues.push("Lookup returned a different candidate identity");
          if (!sameIdentity(resolution.candidate?.identity, identity))
            issues.push(
              "Lookup metadata returned a different candidate identity",
            );
          if (
            item?.status !== "published" ||
            item.releaseId !== resolution.releaseId
          )
            issues.push("Catalog and direct lookup disagree");
          if (resolution.race?.manifest?.id !== resolution.releaseId)
            issues.push("Lookup race/release mismatch");
          releases.set(resolution.releaseId, resolution.race);
        }
        resolutions.push({
          identity,
          status: resolution?.status,
          releaseId: resolution?.releaseId,
          issues,
        });
      } catch (error) {
        result.invalid.push({ identity, errors: [error.message] });
      }
    },
  );
  const policies = new Set();
  await mapBounded(
    [...releases],
    concurrency,
    async ([releaseId, resolvedRace]) => {
      try {
        const race = await query("race", { releaseId, language: "en" });
        assert.deepEqual(
          race,
          resolvedRace,
          "Direct lookup and race endpoint disagree",
        );
        const members = roster.candidates.filter(
          (candidate) =>
            candidate.identity.contestId === race?.manifest?.contestId &&
            candidate.identity.jurisdiction === race?.manifest?.jurisdiction,
        );
        const check = checkRace(race, members, {
          now: Date.parse(result.checkedAt),
          snapshotId: catalog?.snapshotId,
          policyVersion: values["policy-version"],
        });
        policies.add(check.policyVersion);
        races.push(check);
      } catch (error) {
        result.invalid.push({ releaseId, errors: [error.message] });
      }
    },
  );
  if (policies.size > 1)
    errors.push("Published races use inconsistent policy versions");
  if (!values["policy-version"])
    errors.push(
      "--policy-version is required to independently establish current approved publication policy",
    );
  for (const resolution of resolutions)
    if (resolution.issues.length) result.invalid.push(resolution);
  for (const race of races)
    if (race.issues.length || race.briefs.some((brief) => brief.errors.length))
      result.invalid.push(race);
  if (result.unavailable.length)
    errors.push(
      `${result.unavailable.length} expected candidates lack published research`,
    );
  if (result.invalid.length)
    errors.push(`${result.invalid.length} invalid public lookups or releases`);
  result.totals = {
    expectedCandidates: expected.size,
    stateCandidates: stateCount,
    sanJoseLocalCandidates: localCount,
    catalogCandidates: publicItems.size,
    directLookups: catalog ? expected.size : 0,
    successfulLookupResponses: resolutions.length,
    publishedRaces: races.length,
    missing: result.missing.length,
    unverified: result.unverified.length,
    unavailable: result.unavailable.length,
    invalid: result.invalid.length,
  };
  result.passed = !errors.length;
  const output = JSON.stringify(result, null, 2) + "\n";
  if (values.out) await writeFile(values.out, output);
  console.log(
    values.out
      ? JSON.stringify(
          {
            out: values.out,
            passed: result.passed,
            scope: result.scope,
            totals: result.totals,
            errors,
          },
          null,
          2,
        )
      : output,
  );
  process.exitCode = result.passed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
