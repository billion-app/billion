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

const renewalReceipt = {
  receiptHash:
    "9b23400c34796de76dbe25140c356e508e3ecd0ae1617c31116df1ecc3c6f519",
  scopeDigest:
    "a04b0dc8a476fb06ed52d9aace451f6564fdaa476a672e751595fcd47c9562b7",
  reviewedSourceBundleHash:
    "f3277611713e1c281d2604dc7cb2349e67551d1149343a5edac16309f1205aea",
  actorId: "ai:gpt-6-astra:san-jose-full-scope-review:2026-10-30",
};
const authorityProjections = {
  "cde-item-48870daecfe14c6ab376f6a673491914-telemetry-v1": {
    url: "https://www.arcgis.com/sharing/rest/content/items/48870daecfe14c6ab376f6a673491914?f=json",
    reviewedContentHash:
      "4f8e7401cfb9cbf37b8fc7754df24f358d5e344884a9fca0d19f300a161adccd",
    canonicalDigest:
      "720348bff7cd6b05bf80f187822ccf406d659566dfa28d548d05f7812489d2fc",
  },
  "mvla-trustee-authority-seven-asset-versions-v1": {
    url: "https://www.mvla.net/trustee-area-election-information",
    reviewedContentHash:
      "e949457045f72afdaa13a78513de14dd7c9e80e99088d79c8e0c3cf5d056a79f",
    canonicalDigest:
      "23e6295294ed84717528e916f9ce5f69ddd4ae22f43adfa27d734ccbd80ee2ff",
  },
};
const assetTags = [
  '<script src="/js/slick-a11y.js?v=',
  '<link rel="stylesheet" type="text/css" href="/css/main-sass.css?v=',
  '<script src="/js/classes/ColorContrast.js?v=',
  '<script src="/js/stack_items.js?v=',
  '<script type="module" src="/js/components.js?v=',
  '<script src="/js/general.js?v=',
  '<script src="/js/deviceDetector.js?v=',
];
function strictJson(text) {
  let offset = 0;
  const whitespace = () => {
    while (/[ \t\r\n]/.test(text[offset] ?? "") && offset < text.length)
      offset++;
  };
  const string = () => {
    assert.equal(text[offset++], '"', "Expected JSON string");
    const start = offset - 1;
    while (offset < text.length) {
      const char = text[offset++];
      if (char === "\\") offset++;
      else if (char === '"') return JSON.parse(text.slice(start, offset));
    }
    throw new Error("Unterminated JSON string");
  };
  const value = (depth = 0) => {
    assert.ok(depth <= 100, "JSON nesting exceeds bound");
    whitespace();
    if (text[offset] === '"') return string();
    if (text[offset] === "{") {
      offset++;
      const result = Object.create(null),
        keys = new Set();
      whitespace();
      if (text[offset] === "}") {
        offset++;
        return result;
      }
      while (true) {
        whitespace();
        const name = string();
        assert.ok(!keys.has(name), `Duplicate JSON key ${name}`);
        keys.add(name);
        whitespace();
        assert.equal(text[offset++], ":", "Expected JSON colon");
        result[name] = value(depth + 1);
        whitespace();
        const separator = text[offset++];
        if (separator === "}") return result;
        assert.equal(separator, ",", "Expected JSON object separator");
      }
    }
    if (text[offset] === "[") {
      offset++;
      const result = [];
      whitespace();
      if (text[offset] === "]") {
        offset++;
        return result;
      }
      while (true) {
        result.push(value(depth + 1));
        whitespace();
        const separator = text[offset++];
        if (separator === "]") return result;
        assert.equal(separator, ",", "Expected JSON array separator");
      }
    }
    const token =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        text.slice(offset),
      )?.[0];
    assert.ok(token, "Invalid JSON value");
    offset += token.length;
    const result = JSON.parse(token);
    assert.ok(
      typeof result !== "number" || Number.isFinite(result),
      "Nonfinite JSON number",
    );
    return result;
  };
  const result = value();
  whitespace();
  assert.equal(offset, text.length, "Trailing JSON content");
  return result;
}

export function authorityProjectionDigest(projectionId, url, text) {
  const approved = Object.hasOwn(authorityProjections, projectionId)
    ? authorityProjections[projectionId]
    : undefined;
  assert.ok(
    approved && approved.url === url,
    "Unapproved authority URL or projector",
  );
  if (projectionId.startsWith("cde-item-")) {
    const item = strictJson(text);
    assert.equal(
      item?.id,
      "48870daecfe14c6ab376f6a673491914",
      "Different CDE item identity",
    );
    for (const field of ["lastViewed", "numViews"]) {
      assert.ok(
        Number.isSafeInteger(item[field]) && item[field] >= 0,
        `Invalid CDE ${field}`,
      );
      delete item[field];
    }
    return hash(canonical(item));
  }
  let projected = text,
    version;
  for (const tag of assetTags) {
    assert.equal(
      projected.split(tag).length,
      2,
      "Missing or duplicate approved asset tag",
    );
    const start = projected.indexOf(tag) + tag.length;
    const timestamp = projected.slice(start, start + 14);
    assert.match(timestamp, /^\d{14}$/, "Invalid asset version timestamp");
    assert.equal(
      projected.slice(start + 14, start + 16),
      '">',
      "Changed asset tag suffix",
    );
    const iso = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}.000Z`;
    assert.ok(
      Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString() === iso,
      "Invalid asset version calendar date",
    );
    if (version)
      assert.equal(timestamp, version, "Inconsistent asset versions");
    version = timestamp;
    projected =
      projected.slice(0, start) +
      "[CACHE_VERSION]" +
      projected.slice(start + 14);
  }
  return hash(projected);
}

export function authorityRenewalErrors(
  primary,
  currentSources,
  scopeDigest,
  now = Date.now(),
) {
  const errors = [],
    projections = primary?.sourceRenewalProjections ?? [],
    proofs = primary?.sourceProjectionProofs ?? [];
  const seen = new Set();
  for (const projection of projections) {
    try {
      const approved = Object.hasOwn(
        authorityProjections,
        projection.projectionId,
      )
        ? authorityProjections[projection.projectionId]
        : undefined;
      assert.ok(approved, "Unapproved authority projection");
      assert.ok(
        !seen.has(projection.projectionId),
        "Duplicate authority projection",
      );
      seen.add(projection.projectionId);
      for (const field of ["url", "reviewedContentHash", "canonicalDigest"])
        assert.equal(
          projection[field],
          approved[field],
          `Unapproved authority ${field}`,
        );
      assert.equal(
        projection.reviewedRawHash,
        approved.reviewedContentHash,
        "Wrong reviewed raw archive",
      );
      assert.equal(projection.format, "text");
      assert.ok(nonempty(projection.publisher), "Missing authority publisher");
      for (const [field, value] of Object.entries(renewalReceipt))
        assert.equal(
          projection.approval?.[field],
          value,
          `Unapproved authority review ${field}`,
        );
      assert.equal(
        scopeDigest,
        renewalReceipt.scopeDigest,
        "Authority renewal belongs to a different reviewed census",
      );
      assert.equal(
        Date.parse(projection.approval.reviewedAt),
        Date.parse("2026-10-30T20:18:50.276Z"),
        "Authority approval date differs from the acknowledged receipt",
      );
      assert.ok(
        Date.parse(projection.approval.reviewedAt) <= now,
        "Future authority approval date",
      );
      const original = projection.reviewedSource;
      assert.ok(
        original &&
          original.url === projection.url &&
          original.publisher === projection.publisher &&
          original.format === projection.format,
        "Reviewed authority source identity mismatch",
      );
      assert.equal(
        hash(original.text),
        projection.reviewedContentHash,
        "Reviewed authority archive hash mismatch",
      );
      assert.equal(
        authorityProjectionDigest(
          projection.projectionId,
          original.url,
          original.text,
        ),
        approved.canonicalDigest,
        "Reviewed authority projection mismatch",
      );
      const matches = currentSources.filter(
        (source) => source.url === projection.url,
      );
      assert.equal(
        matches.length,
        1,
        "Current authority archive is missing or duplicated",
      );
      const current = matches[0];
      assert.equal(
        current.publisher,
        projection.publisher,
        "Current authority publisher mismatch",
      );
      assert.equal(
        current.format,
        projection.format,
        "Current authority format mismatch",
      );
      assert.equal(
        hash(current.text),
        current.contentHash,
        "Current authority content hash mismatch",
      );
      assert.equal(
        current.byteHash,
        current.contentHash,
        "Current authority raw hash mismatch",
      );
      assert.equal(
        authorityProjectionDigest(
          projection.projectionId,
          current.url,
          current.text,
        ),
        approved.canonicalDigest,
        "Current authority contains unapproved changes",
      );
      const proofMatches = proofs.filter(
        (proof) => proof.projectionId === projection.projectionId,
      );
      assert.equal(
        proofMatches.length,
        1,
        "Missing or duplicate authority renewal proof",
      );
      const proof = proofMatches[0];
      for (const field of [
        "projectionId",
        "url",
        "publisher",
        "format",
        "reviewedContentHash",
        "reviewedRawHash",
        "canonicalDigest",
      ])
        assert.equal(
          proof[field],
          projection[field],
          `Authority proof ${field} mismatch`,
        );
      assert.equal(
        proof.observedContentHash,
        current.contentHash,
        "Authority proof observed content mismatch",
      );
      assert.equal(
        proof.observedRawHash,
        current.byteHash,
        "Authority proof observed raw bytes mismatch",
      );
      assert.equal(
        proof.approvalReceiptHash,
        renewalReceipt.receiptHash,
        "Authority proof receipt mismatch",
      );
      assert.equal(
        proof.checkedAt,
        current.fetchedAt,
        "Authority proof is not bound to the actual fetch timestamp",
      );
      const checked = Date.parse(proof.checkedAt),
        fetched = Date.parse(current.fetchedAt);
      assert.ok(
        fetched <= checked && checked <= now && now - fetched <= 86_400_000,
        "Authority renewal is stale or future dated",
      );
    } catch (error) {
      errors.push(`${projection.projectionId}: ${error.message}`);
    }
  }
  if (
    proofs.some(
      (proof) =>
        !projections.some(
          (projection) => projection.projectionId === proof.projectionId,
        ),
    )
  )
    errors.push("Authority renewal proof has no approved projection");
  return errors;
}

export function sourceArchiveErrors(roster, archive) {
  if (!Array.isArray(archive?.sources))
    return [
      "--fresh-source-archive must contain the HTTP audit companion sources archive",
    ];
  const errors = [];
  for (const source of roster.additionalSources ?? []) {
    const matches = archive.sources.filter(
      (observed) => observed.id === source.id && observed.url === source.url,
    );
    if (matches.length !== 1) {
      errors.push(
        `Current source lacks a unique companion archive ${source.url}`,
      );
      continue;
    }
    const observed = matches[0];
    if (
      typeof observed.text !== "string" ||
      hash(observed.text) !== observed.contentHash ||
      observed.contentHash !== source.contentHash ||
      observed.text !== source.text ||
      observed.byteHash !== source.byteHash ||
      observed.fetchedAt !== source.fetchedAt ||
      observed.publisher !== source.publisher ||
      observed.format !== source.format
    )
      errors.push(
        `Current snapshot differs from independently captured source archive ${source.url}`,
      );
  }
  return errors;
}

export function sourceAuditErrors(roster, audit, now = Date.now()) {
  const errors = [];
  if (
    !audit ||
    audit.schemaVersion !== 1 ||
    !Array.isArray(audit.sources) ||
    !Array.isArray(audit.networkRequests)
  )
    return [
      "A bounded independently captured --source-audit is required for current local proof freshness",
    ];
  if (
    !(
      Date.parse(audit.startedAt) <= Date.parse(audit.completedAt) &&
      Date.parse(audit.completedAt) <= now
    )
  )
    errors.push("HTTP audit timing is invalid or future dated");
  if (
    !(
      audit.observedBodyBytes > 0 &&
      audit.observedBodyBytes <= audit.maxSharedBodyBytes
    )
  )
    errors.push("HTTP audit did not establish its byte bound");
  const projections = roster.localPrimary?.sourceRenewalProjections ?? [];
  const projectedURLs = new Set(
    projections.map((projection) => projection.url),
  );
  for (const record of audit.sources)
    if (record.status !== "PASS" && !projectedURLs.has(record.url))
      errors.push(`Unapproved HTTP audit failure ${record.url}`);
  errors.push(
    ...authorityRenewalErrors(
      roster.localPrimary,
      roster.additionalSources ?? [],
      roster.localCrosswalk?.review?.digest,
      now,
    ),
  );
  for (const source of roster.additionalSources ?? []) {
    const matches = audit.sources.filter(
      (record) => record.id === source.id && record.url === source.url,
    );
    if (matches.length !== 1) {
      errors.push(
        `Current source lacks a unique HTTP observation ${source.url}`,
      );
      continue;
    }
    const record = matches[0],
      actual = record.actual;
    if (
      !actual ||
      actual.textHash !== source.contentHash ||
      (source.byteHash && actual.byteHash !== source.byteHash) ||
      actual.fetchedAt !== source.fetchedAt ||
      actual.url !== source.url
    )
      errors.push(
        `Current archive differs from observed HTTP response ${source.url}`,
      );
    if (
      !(record.bodyBytes > 0) ||
      !audit.networkRequests.some(
        (request) => request.sourceId === source.id && request.status === 200,
      )
    )
      errors.push(
        `Current source lacks successful observed HTTP bytes ${source.url}`,
      );
    const fetched = Date.parse(source.fetchedAt);
    if (
      !(
        Date.parse(record.startedAt) <= fetched &&
        fetched <= Date.parse(record.completedAt) &&
        Date.parse(audit.startedAt) <= fetched &&
        fetched <= Date.parse(audit.completedAt) &&
        fetched <= now &&
        now - fetched <= 86_400_000
      )
    )
      errors.push(
        `Current source observation is stale or has invalid timing ${source.url}`,
      );
  }
  return errors;
}

export function clarityIdentityErrors(roster) {
  const primary = roster.localPrimary;
  if (!primary) return [];
  try {
    const sources = roster.additionalSources ?? [];
    const definition = sources.find(
      (source) => source.url === primary.definitionURL,
    );
    const rows = strictJson(definition.text);
    assert.ok(Array.isArray(rows), "Clarity definition is not a contest array");
    const version = sources
      .find((source) => source.url === primary.currentVersionURL)
      ?.text.trim();
    assert.match(version ?? "", /^\d{6}$/, "Invalid current Clarity version");
    const root =
      "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/";
    assert.equal(
      primary.definitionURL,
      `${root}${version}/json/en/summary.json`,
      "Clarity definition is not current",
    );
    assert.equal(
      primary.settingsURL,
      `${root}${version}/json/en/electionsettings.json`,
      "Clarity settings are not current",
    );
    const xml = sources.find(
      (source) =>
        source.url ===
        `${root}${version}/reports/detailwithoutvotetypesxml.zip`,
    )?.text;
    assert.ok(
      typeof xml === "string",
      "Current official Clarity identity XML is absent",
    );
    const contests = new Map();
    for (const match of xml.matchAll(
      /<Contest\b([^>]*)>([\s\S]*?)<\/Contest>/g,
    )) {
      const contestKey = /(?:^|\s)key="(\d+)"/.exec(match[1])?.[1];
      assert.ok(
        contestKey && !contests.has(contestKey),
        "Duplicate or absent official XML contest key",
      );
      const choices = [...match[2].matchAll(/<Choice\b([^>]*)>/g)].map(
        (choice) => /(?:^|\s)key="(\d+)"/.exec(choice[1])?.[1],
      );
      assert.ok(
        choices.every(Boolean) && new Set(choices).size === choices.length,
        "Duplicate or absent official XML choice key",
      );
      contests.set(contestKey, choices);
    }
    const errors = [];
    for (const race of (roster.races ?? []).filter(
      (race) => race.officeFamily === "local",
    )) {
      for (const member of race.members) {
        const mappings = primary.identityCrosswalk.members.filter(
          (mapping) =>
            mapping.sourceContestId === race.sourceContestId &&
            mapping.name === member.name,
        );
        if (mappings.length !== 1) {
          errors.push(
            `Local member has no unique reviewed mapping ${member.identity.candidateId}`,
          );
          continue;
        }
        const mapping = mappings[0],
          row = rows.find((row) => row.K === mapping.clarityContestKey),
          choices = contests.get(mapping.clarityContestKey);
        const officialKey = choices?.[mapping.clarityChoiceIndex];
        const contestId = `ca-scc-clarity:${roster.electionDate}:127570:${mapping.clarityContestKey}`;
        if (
          !row ||
          row.CH?.[mapping.clarityChoiceIndex] !== member.name ||
          choices?.length !== row.CH?.length ||
          !officialKey ||
          race.contestId !== contestId ||
          member.sourceCandidateId !== officialKey ||
          member.identity.contestId !== contestId ||
          member.identity.candidateId !==
            `${contestId}:choice:${officialKey}` ||
          member.candidateId !== member.identity.candidateId ||
          member.identity.jurisdiction !== race.jurisdiction ||
          member.identity.electionDate !== roster.electionDate ||
          member.ballotStatus !== mapping.status
        )
          errors.push(
            `Local member differs from exact official XML identity ${member.identity.candidateId}`,
          );
      }
    }
    return errors;
  } catch (error) {
    return [`Official local identity verification failed: ${error.message}`];
  }
}

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
    ...(roster.localPrimary?.reviewedSources ?? []),
  ];
  const archived = (proof) =>
    validUrl(proof?.url) &&
    sources.some(
      (source) =>
        source.url === proof.url &&
        source.contentHash === proof.contentHash &&
        (!proof.byteHash || source.byteHash === proof.byteHash) &&
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
    if (roster.localPrimary) {
      for (const proof of entry.proofs ?? []) {
        if (proof.role === "historical_qualification") continue;
        const current = (roster.additionalSources ?? []).find(
          (source) => source.url === proof.url,
        );
        const exact =
          current?.contentHash === proof.contentHash &&
          (!proof.byteHash || current.byteHash === proof.byteHash);
        const projected = (
          roster.localPrimary.sourceRenewalProjections ?? []
        ).some(
          (projection) =>
            projection.url === proof.url &&
            projection.reviewedContentHash === proof.contentHash &&
            !proof.byteHash,
        );
        if (!exact && !projected)
          errors.push(
            `Territorial proof has no current exact or approved projected source ${proof.url}`,
          );
      }
    }
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
    const currentSources = roster.additionalSources ?? [];
    errors.push(...clarityIdentityErrors(roster));
    errors.push(
      ...authorityRenewalErrors(
        primary,
        currentSources,
        crosswalk?.review?.digest,
        now,
      ),
    );
    for (const source of currentSources) {
      if (
        !(
          Date.parse(source.fetchedAt) <= now &&
          now - Date.parse(source.fetchedAt) <= 86_400_000
        )
      )
        errors.push(
          `Current local proof is stale or future dated ${source.url}`,
        );
      if (
        typeof source.text !== "string" ||
        hash(source.text) !== source.contentHash
      )
        errors.push(`Current local proof archive hash mismatch ${source.url}`);
    }
    for (const original of primary.reviewedSources ?? []) {
      if (
        (primary.sourceRenewalProjections ?? []).some(
          (projection) => projection.url === original.url,
        )
      )
        continue;
      const current = currentSources.find(
        (source) => source.url === original.url,
      );
      if (
        !current ||
        current.contentHash !== original.contentHash ||
        (original.byteHash && current.byteHash !== original.byteHash)
      )
        errors.push(
          `Local source changed without an independently replayed approval ${original.url}`,
        );
    }
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
      (crosswalk?.rosterSourceHash !== definition?.contentHash &&
        !sources.some(
          (source) =>
            source.format === "pdf" &&
            source.contentHash === crosswalk?.rosterSourceHash &&
            /^https:\/\/files\.santaclaracounty\.gov\//.test(source.url) &&
            typeof source.text === "string" &&
            hash(source.text) === source.contentHash,
        ))
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

const automatedPolicyVersion = "ca-california-candidate-research-2026-10-30-v2";

export function publicResearchQualityErrors(brief, quality) {
  const errors = [];
  const uniqueIds = (ids, allowEmpty = false) =>
    Array.isArray(ids) &&
    (allowEmpty || ids.length > 0) &&
    ids.every(nonempty) &&
    new Set(ids).size === ids.length;
  if (
    !quality ||
    ![
      "candidate_record",
      "candidate_priorities",
      "reconciled_finance",
    ].includes(quality.basis) ||
    !uniqueIds(quality.claimIds, quality.basis === "reconciled_finance") ||
    !uniqueIds(quality.evidenceIds)
  )
    return [
      "Missing or invalid service-derived substantive research certificate",
    ];
  const evidence = new Map(
    (brief.evidence ?? []).map((source) => [source.id, source]),
  );
  for (const id of quality.evidenceIds)
    if (!evidence.has(id))
      errors.push(
        `Quality certificate references absent public evidence ${id}`,
      );
  const claims = (brief.sections ?? []).flatMap(
    (section) => section.claims ?? [],
  );
  if (quality.basis !== "reconciled_finance") {
    const topic =
      quality.basis === "candidate_record" ? "record" : "priorities";
    const eligible = (brief.sections ?? [])
      .filter((section) => section.topic === topic)
      .flatMap((section) => section.claims ?? []);
    for (const id of quality.claimIds) {
      const matches = eligible.filter((claim) => claim.id === id);
      if (
        matches.length !== 1 ||
        claims.filter((claim) => claim.id === id).length !== 1 ||
        !nonempty(matches[0].text) ||
        !matches[0].evidenceIds?.some((ref) =>
          quality.evidenceIds.includes(ref),
        )
      )
        errors.push(
          `Quality certificate lacks qualifying public ${topic} claim ${id}`,
        );
    }
    for (const id of quality.evidenceIds)
      if (
        !eligible.some(
          (claim) =>
            quality.claimIds.includes(claim.id) &&
            claim.evidenceIds?.includes(id),
        )
      )
        errors.push(
          `Quality evidence is not attached to a qualifying candidate claim ${id}`,
        );
    return errors;
  }
  const finance = brief.research?.finance;
  if (!finance)
    return [...errors, "Reconciled-finance certificate has no public finance"];
  const cents = (value) => Number.isSafeInteger(value) && value >= 0;
  const donors = Array.isArray(finance.donors) ? finance.donors : [],
    outside = finance.outsideSpending;
  const receipts = finance.receipts;
  if (
    receipts &&
    (!cents(receipts.totalCents) ||
      !receipts.breakdown ||
      Object.values(receipts.breakdown).some((amount) => !cents(amount)) ||
      Object.values(receipts.breakdown).reduce(
        (sum, amount) => sum + amount,
        0,
      ) !== receipts.totalCents)
  )
    errors.push("Public finance receipt totals do not reconcile");
  if (
    !Array.isArray(finance.donors) ||
    donors.some((donor) => !cents(donor.amountCents)) ||
    (outside !== null &&
      (!Array.isArray(outside) ||
        outside.some((entry) => !cents(entry.amountCents))))
  )
    errors.push("Public finance has invalid substantive amounts");
  const positive =
    (receipts && cents(receipts.totalCents) && receipts.totalCents > 0) ||
    donors.some((donor) => donor.amountCents > 0) ||
    (Array.isArray(outside) && outside.some((entry) => entry.amountCents > 0));
  const reportedZero =
    receipts && cents(receipts.totalCents) && receipts.totalCents === 0;
  const verifiedOutsideZero =
    finance.coverage === "complete" &&
    Array.isArray(outside) &&
    outside.length === 0;
  if (!positive && !reportedZero && !verifiedOutsideZero)
    errors.push(
      "Finance is an availability gap or unsupported zero rather than substantive research",
    );
  if (
    !nonempty(finance.committeeId) ||
    !nonempty(finance.committeeName) ||
    !nonempty(finance.coverageNote) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(finance.periodStart ?? "") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(finance.periodEnd ?? "") ||
    !Number.isFinite(Date.parse(finance.periodStart)) ||
    !Number.isFinite(Date.parse(finance.periodEnd)) ||
    finance.periodStart > finance.periodEnd ||
    !["complete", "partial"].includes(finance.coverage) ||
    !uniqueIds(finance.filingEvidenceIds)
  )
    errors.push("Public finance lacks identified filing coverage");
  const financeIds = [
    ...new Set([
      ...(finance.filingEvidenceIds ?? []),
      ...donors.flatMap((donor) => donor.evidenceIds ?? []),
      ...(Array.isArray(outside)
        ? outside.flatMap((entry) => entry.evidenceIds ?? [])
        : []),
    ]),
  ].sort();
  if (
    JSON.stringify([...quality.evidenceIds].sort()) !==
    JSON.stringify(financeIds)
  )
    errors.push(
      "Finance certificate does not match exact public finance evidence",
    );
  for (const id of financeIds)
    if (evidence.get(id)?.origin !== "primary_record")
      errors.push(`Finance lacks public primary-record evidence ${id}`);
  const financeClaims = claims
    .filter((claim) => claim.evidenceIds?.some((id) => financeIds.includes(id)))
    .map((claim) => claim.id)
    .sort();
  if (
    JSON.stringify([...quality.claimIds].sort()) !==
    JSON.stringify(financeClaims)
  )
    errors.push(
      "Finance certificate does not match exact public finance claims",
    );
  return errors;
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
    const reviewedDossier = manifest.reviewedDossiers?.[identity?.candidateId];
    const certificate = reviewedDossier?.quality;
    const requiresQuality = manifest.policyVersion === automatedPolicyVersion;
    const qualityErrors =
      requiresQuality || certificate
        ? publicResearchQualityErrors(brief, certificate)
        : [];
    errors.push(...qualityErrors);
    if (
      requiresQuality &&
      (!/^[a-f0-9]{64}$/.test(reviewedDossier?.dossierDigest ?? "") ||
        !/^[a-f0-9]{64}$/.test(reviewedDossier?.sourceSetDigest ?? "") ||
        !nonempty(reviewedDossier?.authorRunId))
    )
      errors.push("Quality certificate lacks exact reviewed dossier metadata");
    const financeQualified =
      certificate?.basis === "reconciled_finance" && qualityErrors.length === 0;
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
      !financeQualified &&
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
      researchQuality:
        certificate ?? quality ?? "legacy structural checks only",
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
      "source-audit": { type: "string" },
      "fresh-source-archive": { type: "string" },
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
  const auditBytes = values["source-audit"]
    ? await readFile(values["source-audit"], "utf8")
    : null;
  const sourceAudit = auditBytes ? JSON.parse(auditBytes) : null;
  const archiveBytes = values["fresh-source-archive"]
    ? await readFile(values["fresh-source-archive"], "utf8")
    : null;
  const freshArchive = archiveBytes ? JSON.parse(archiveBytes) : null;
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
      sourceAudit: auditBytes
        ? { path: values["source-audit"], sha256: hash(auditBytes) }
        : null,
      freshSourceArchive: archiveBytes
        ? { path: values["fresh-source-archive"], sha256: hash(archiveBytes) }
        : null,
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
  if (!values["state-only"]) {
    errors.push(...finalScopeErrors(roster, Date.parse(result.checkedAt)));
    if (roster.localPrimary) {
      errors.push(
        ...sourceAuditErrors(roster, sourceAudit, Date.parse(result.checkedAt)),
      );
      errors.push(...sourceArchiveErrors(roster, freshArchive));
    }
  }
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
