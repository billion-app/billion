import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { load } from "cheerio";
import { z } from "zod/v4";

import type {
  AuthorityRenewalProjection,
  CaliforniaRaceTarget,
  CaliforniaRosterSnapshot,
  ClarityCandidateCrosswalk,
  ClarityRosterDerivation,
  ResearchSource,
} from "@acme/validators";
import {
  californiaRosterSnapshotSchema,
  clarityCandidateCrosswalkSchema,
  sanJoseScopeCrosswalkSchema,
} from "@acme/validators";

import {
  parseSantaClaraQualifiedRoster,
  parseSantaClaraQualifiedWriteIns,
  sanJoseScopeCrosswalkDigest,
} from "./california-roster.js";
import { validateAuthorityRenewalProjection } from "./california-source-projections.js";

const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const root = "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/";
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value !== null && typeof value === "object"
      ? `{${Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
          .join(",")}}`
      : JSON.stringify(value);
export function clarityCandidateCrosswalkDigest(
  value: Omit<ClarityCandidateCrosswalk, "review">,
) {
  return hash(canonical(value));
}
const definitionSchema = z
  .array(
    z.object({
      K: z.string().regex(/^\d+$/),
      C: z.string().min(1),
      CAT: z.enum([
        "Local",
        "School",
        "State and Federal",
        "Measures",
        "Propositions",
        "Judicial",
      ]),
      VF: z.number().int().nonnegative(),
      CH: z.array(z.string().min(1)).min(1),
      P: z.array(z.string()),
    }),
  )
  .min(1)
  .max(500);
export function parseSantaClaraClarityDefinition(source: ResearchSource) {
  if (
    source.text.length > 5_000_000 ||
    hash(source.text) !== source.contentHash
  )
    throw new Error("Invalid Clarity definition archive");
  const rows = definitionSchema.parse(JSON.parse(source.text));
  if (new Set(rows.map((r) => r.K)).size !== rows.length)
    throw new Error("Duplicate Clarity contest key");
  const local = rows.filter((r) => r.CAT === "Local" || r.CAT === "School");
  for (const row of local)
    if (
      row.VF < 1 ||
      row.P.length !== row.CH.length ||
      row.CH.filter((n) => n !== "Write-in").length < 1 ||
      new Set(row.CH).size !== row.CH.length
    )
      throw new Error("Incomplete Clarity local contest");
  return local;
}
interface ClarityRosterInput {
  definition: ResearchSource;
  settings: ResearchSource;
  currentVersion: ResearchSource;
  proofSources: ResearchSource[];
  scopeCrosswalk: unknown;
  identityCrosswalk: unknown;
  historicalSources?: ResearchSource[];
  sourceRenewalProjections?: AuthorityRenewalProjection[];
}
interface ClarityDerivationContext {
  proof: ClarityRosterDerivation;
  members: ClarityCandidateCrosswalk["members"];
  reviewedSources: ResearchSource[];
  proofMap: Map<
    string,
    { url: string; contentHash: string; byteHash?: string }
  >;
}
export function appendReviewedClaritySanJoseRoster(
  state: CaliforniaRosterSnapshot,
  input: ClarityRosterInput,
): CaliforniaRosterSnapshot {
  return compileClaritySanJoseRoster(state, input);
}
function compileClaritySanJoseRoster(
  state: CaliforniaRosterSnapshot,
  input: ClarityRosterInput,
  derivation?: ClarityDerivationContext,
  reviewedSourcesOverride?: ResearchSource[],
): CaliforniaRosterSnapshot {
  const version = input.currentVersion.text.trim();
  if (
    !/^\d{6}$/.test(version) ||
    input.currentVersion.url !== `${root}current_ver.txt` ||
    hash(input.currentVersion.text) !== input.currentVersion.contentHash
  )
    throw new Error("Clarity current report version is not verified");
  if (
    input.definition.url !== `${root}${version}/json/en/summary.json` ||
    input.settings.url !== `${root}${version}/json/en/electionsettings.json`
  )
    throw new Error("Clarity source is not the current election report");
  if (hash(input.settings.text) !== input.settings.contentHash)
    throw new Error("Clarity settings archive hash mismatch");
  const settings = JSON.parse(input.settings.text) as {
    entityname?: unknown;
    versions?: unknown;
  };
  if (
    settings.entityname !== "Santa Clara" ||
    !Array.isArray(settings.versions) ||
    !settings.versions.includes(version)
  )
    throw new Error("Clarity county election context mismatch");
  const local = parseSantaClaraClarityDefinition(input.definition);
  const xmlSource = input.proofSources.find(
    (p) => p.url === `${root}${version}/reports/detailwithoutvotetypesxml.zip`,
  );
  if (!xmlSource || hash(xmlSource.text) !== xmlSource.contentHash)
    throw new Error("Current official Clarity XML archive is required");
  const $ = load(xmlSource.text, { xmlMode: true });
  if (
    $("ElectionDate").text() !== "11/3/2026" ||
    $("Region").text() !== "Santa Clara"
  )
    throw new Error("Clarity XML election context mismatch");
  const choiceIds = new Map<string, string>();
  for (const row of local) {
    const contest = $("Contest").filter(
      (_, element) => $(element).attr("key") === row.K,
    );
    const choices = contest.children("Choice");
    if (
      contest.length !== 1 ||
      contest.attr("text") !== row.C ||
      Number(contest.attr("voteFor")) !== row.VF ||
      choices.length !== row.CH.length
    )
      throw new Error("Clarity JSON/XML contest context mismatch");
    choices.each((index, element) => {
      const choice = $(element),
        key = choice.attr("key");
      if (
        choice.attr("text")?.replaceAll('""', '"') !==
          row.CH[index]?.replaceAll("''", '"') ||
        !key ||
        !/^\d+$/.test(key)
      )
        throw new Error("Clarity JSON/XML candidate context mismatch");
      choiceIds.set(`${row.K}:${index}`, key);
    });
    if (
      new Set(choices.map((_, element) => $(element).attr("key")).get())
        .size !== choices.length
    )
      throw new Error("Duplicate official Clarity choice key");
  }

  const identities = clarityCandidateCrosswalkSchema.parse(
    input.identityCrosswalk,
  );
  const { review: identityReview, ...identityDocument } = identities;
  if (
    identityReview.digest !==
      clarityCandidateCrosswalkDigest(identityDocument) ||
    (!derivation && identities.definitionHash !== input.definition.contentHash)
  )
    throw new Error("Clarity identity crosswalk is unreviewed or stale");
  const scope = sanJoseScopeCrosswalkSchema.parse(input.scopeCrosswalk);
  const { review, ...scopeDocument } = scope;
  if (
    review.digest !== sanJoseScopeCrosswalkDigest(scopeDocument) ||
    (!derivation &&
      scope.rosterSourceHash !== input.definition.contentHash &&
      !verifiedHistoricalAliasBasis(input, scope, identities))
  )
    throw new Error("Clarity territorial crosswalk is unreviewed or stale");
  if (
    new Set(scope.entries.map((e) => e.sourceContestId)).size !==
    scope.entries.length
  )
    throw new Error("Duplicate scope contest identity");
  const sources = [
    input.definition,
    input.settings,
    input.currentVersion,
    ...input.proofSources,
  ];
  for (const source of sources) {
    if (hash(source.text) !== source.contentHash)
      throw new Error("Original Clarity territorial source hash mismatch");
    if (source.format === "image" || source.binaryBase64 !== undefined) {
      const bytes = Buffer.from(source.binaryBase64 ?? "", "base64");
      if (
        (source.format === "image" && source.text !== "") ||
        !source.byteHash ||
        !bytes.length ||
        bytes.length > 5_000_000 ||
        bytes.toString("base64") !== source.binaryBase64 ||
        hash(bytes) !== source.byteHash
      )
        throw new Error(
          "Image proof archive bytes do not match its strong byte hash",
        );
    }
  }
  const projectionContracts = input.sourceRenewalProjections ?? [];
  if (
    new Set(projectionContracts.map((contract) => contract.url)).size !==
    projectionContracts.length
  )
    throw new Error("Duplicate authority renewal projection");
  const projectionResults = projectionContracts.map((contract) => {
    const observed = sources.find((source) => source.url === contract.url);
    if (!observed) throw new Error("Projected authority source absent");
    return validateAuthorityRenewalProjection(
      contract,
      observed,
      review.digest,
    );
  });
  const projectionProofs = projectionResults.map((result) => result.proof);
  const proofMap = new Map(derivation?.proofMap ?? []);
  for (const { contract, proof } of projectionResults) {
    const ref = {
      url: proof.url,
      contentHash: proof.observedContentHash,
      byteHash: proof.observedRawHash,
    };
    proofMap.set(`${contract.url}:${contract.reviewedContentHash}:`, ref);
    proofMap.set(
      `${contract.url}:${contract.reviewedContentHash}:${contract.reviewedRawHash}`,
      ref,
    );
  }
  const observedMembers = derivation?.members ?? identities.members;
  const keys = new Set<string>();
  const mapped = new Set<string>();
  const contestMap = new Map<string, string>();
  for (const member of observedMembers) {
    const row = local.find((r) => r.K === member.clarityContestKey);
    const key = `${member.clarityContestKey}:${member.clarityChoiceIndex}`;
    if (
      !row ||
      row.CH[member.clarityChoiceIndex] !== member.name ||
      member.name === "Write-in" ||
      keys.has(key)
    )
      throw new Error("Ambiguous Clarity candidate identity crosswalk");
    keys.add(key);
    const prior = contestMap.get(row.K);
    if (prior && prior !== member.sourceContestId)
      throw new Error("Clarity contest mapped to multiple source contests");
    contestMap.set(row.K, member.sourceContestId);
    mapped.add(member.sourceContestId);
  }
  const named = local.flatMap((r) =>
    r.CH.flatMap((name, index) =>
      name === "Write-in" ? [] : [`${r.K}:${index}`],
    ),
  );
  if (
    named.length !== keys.size ||
    named.some((key) => !keys.has(key)) ||
    contestMap.size !== local.length
  )
    throw new Error(
      "Clarity identity crosswalk does not cover the complete local population",
    );
  for (const entry of scope.entries) {
    if (mapped.has(entry.sourceContestId) && entry.status === "off_ballot")
      throw new Error("Clarity on-ballot race labeled off-ballot");
    if (!mapped.has(entry.sourceContestId) && entry.status !== "off_ballot")
      throw new Error("Scope contest absent from current Clarity ballot");
    if (entry.status === "off_ballot") continue;
    for (const reviewedRef of entry.proofs) {
      if (reviewedRef.role === "historical_qualification") {
        const archive = input.historicalSources?.find(
          (source) =>
            source.url === reviewedRef.url &&
            source.contentHash === reviewedRef.contentHash &&
            (!reviewedRef.byteHash || source.byteHash === reviewedRef.byteHash),
        );
        const url = new URL(reviewedRef.url);
        if (
          !archive ||
          archive.format !== "pdf" ||
          url.origin !== "https://files.santaclaracounty.gov" ||
          !/^\/.*\/2026-10\/writeincandidates_[^/]+\.pdf$/.test(url.pathname)
        )
          throw new Error(
            "Historical qualification proof must be the archived official Santa Clara write-in record",
          );
        const qualified = parseSantaClaraQualifiedWriteIns(archive);
        const members = observedMembers.filter(
          (member) =>
            member.sourceContestId === entry.sourceContestId &&
            member.status === "qualified_write_in",
        );
        if (!members.length)
          throw new Error(
            "Historical qualification proof does not identify a current named write-in",
          );
        for (const member of members) {
          const officialId =
            member.officialCandidateId ??
            member.sourceOrdinal.replace(/^write-in:/, "");
          const record = qualified.find(
            (record) =>
              record.sourceContestId === entry.sourceContestId &&
              record.sourceCandidateId === officialId &&
              record.name === member.name,
          );
          if (
            !record ||
            !choiceIds.has(
              `${member.clarityContestKey}:${member.clarityChoiceIndex}`,
            )
          )
            throw new Error(
              "Archived qualification does not match current Clarity candidate and official source ID",
            );
          const [month, day, year] = record.qualifiedDate.split("/");
          const date = `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
          if (
            date > state.electionDate ||
            date > archive.fetchedAt.slice(0, 10)
          )
            throw new Error(
              "Historical qualification date is outside its archived election context",
            );
        }
        continue;
      }

      const reviewedSource = (derivation?.reviewedSources ?? sources).find(
        (source) =>
          source.url === reviewedRef.url &&
          source.contentHash === reviewedRef.contentHash,
      );
      if (reviewedSource?.format === "image" && !reviewedRef.byteHash)
        throw new Error(
          "Image territorial proof must bind its strong byte hash",
        );
      const ref =
        proofMap.get(
          `${reviewedRef.url}:${reviewedRef.contentHash}:${reviewedRef.byteHash ?? ""}`,
        ) ?? reviewedRef;
      if (
        !sources.some(
          (s) =>
            s.url === ref.url &&
            s.contentHash === ref.contentHash &&
            (!ref.byteHash || s.byteHash === ref.byteHash),
        )
      )
        throw new Error("Required territorial proof is missing or changed");
    }
  }
  if (
    [...mapped].some(
      (code) => !scope.entries.some((e) => e.sourceContestId === code),
    )
  )
    throw new Error("Current Clarity contest missing from scope ledger");
  const races: CaliforniaRaceTarget[] = scope.entries
    .filter((e) => e.status === "include")
    .map((entry) => {
      if (!entry.jurisdiction || !entry.jurisdictionLabel)
        throw new Error("Local jurisdiction has not been verified");
      const membersMapped = observedMembers.filter(
        (m) => m.sourceContestId === entry.sourceContestId,
      );
      const row = local.find(
        (r) => r.K === membersMapped[0]?.clarityContestKey,
      )!;
      const contestId = `ca-scc-clarity:2026-11-03:127570:${row.K}`;
      const members: CaliforniaRaceTarget["members"] = membersMapped
        .sort((a, b) => a.clarityChoiceIndex - b.clarityChoiceIndex)
        .map((m) => {
          const sourceCandidateId = choiceIds.get(
            `${row.K}:${m.clarityChoiceIndex}`,
          )!;
          const candidateId = `${contestId}:choice:${sourceCandidateId}`;
          return {
            identity: {
              candidateId,
              contestId,
              jurisdiction: entry.jurisdiction!,
              electionDate: state.electionDate,
            },
            candidateId,
            name: m.name,
            sourceCandidateId,
            partyCode: "",
            party: null,
            ballotStatus: m.status,
            sourceProof: {
              url: input.definition.url,
              contentHash: input.definition.contentHash,
              excerpt: JSON.stringify(m.name),
              locator: `Clarity election 127570, contest K=${row.K}, official Choice key=${sourceCandidateId}, CH[${m.clarityChoiceIndex}]; reviewed county contest ${entry.sourceContestId}, source ordinal ${m.sourceOrdinal}`,
            },
          };
        });
      return {
        raceKey: `ca-scc-clarity-2026-11-03-127570-${row.K}`,
        contestId,
        jurisdiction: entry.jurisdiction,
        jurisdictionLabel: entry.jurisdictionLabel,
        electionDate: state.electionDate,
        sourceContestId: entry.sourceContestId,
        officeFamily: "local",
        office: row.C,
        district: entry.district ?? null,
        kind: "election",
        voteFor: row.VF,
        rosterDigest: hash(
          JSON.stringify(
            members.map(({ sourceProof: _observation, ...member }) => ({
              ...member,
              name: member.name.replaceAll('""', '"').replaceAll("''", '"'),
            })),
          ),
        ),
        rosterSourceUrl: input.definition.url,
        sourceProof: {
          url: input.definition.url,
          contentHash: input.definition.contentHash,
          locator: `Election 127570, contest K=${row.K}; complete named CH membership, generic Write-in excluded`,
        },
        territoryProof: {
          kind: "reviewed_crosswalk",
          ...review,
          method: scope.method,
          reason: entry.reason,
          proofs: entry.proofs,
          ...(derivation || projectionProofs.length
            ? {
                observedProofs: entry.proofs
                  .filter((ref) => ref.role !== "historical_qualification")
                  .map(
                    (ref) =>
                      proofMap.get(
                        `${ref.url}:${ref.contentHash}:${ref.byteHash ?? ""}`,
                      ) ?? ref,
                  ),
                ...(derivation ? { derivation: derivation.proof } : {}),
              }
            : {}),
        },
        members,
      };
    });
  const pending = scope.entries.filter((e) => e.status === "pending");
  return californiaRosterSnapshotSchema.parse({
    ...state,
    id: hash(
      canonical({
        stateId: state.id,
        scopeReviewDigest: review.digest,
        identityReviewDigest: identityReview.digest,
        claritySemanticDigest:
          derivation?.proof.semanticDigest ??
          semanticClarityDefinition(
            input,
            originalClarityAliases(input, identities),
          ).digest,
        sourceIdentities: sources
          .map((source) => {
            const logical =
              source.url === input.definition.url
                ? "clarity-definition"
                : source.url === input.settings.url
                  ? "clarity-settings"
                  : source.url === input.currentVersion.url
                    ? "clarity-current-version"
                    : source.url === xmlSource.url
                      ? "clarity-xml"
                      : undefined;
            if (logical) return { key: logical };
            const projection = projectionResults.find(
              (result) => result.contract.url === source.url,
            );
            if (projection)
              return {
                key: source.url,
                projectionId: projection.contract.projectionId,
                canonicalDigest: projection.proof.canonicalDigest,
                reviewedContentHash: projection.contract.reviewedContentHash,
              };
            const strong = scope.entries.some((entry) =>
              entry.proofs.some(
                (ref) => ref.url === source.url && ref.byteHash,
              ),
            );
            return {
              key: source.url,
              contentHash: source.contentHash,
              ...(strong ? { byteHash: source.byteHash } : {}),
            };
          })
          .sort((a, b) => a.key.localeCompare(b.key)),
      }),
    ),
    scope: "ca_sos_certified_and_san_jose",
    scopeLabel:
      "California state-certified candidates and local contests San José voters can vote in. Other California local contests are outside this scope.",
    races: [...state.races, ...races],
    additionalSources: sources,
    localCrosswalk: scope,
    localPrimary: {
      kind: "scc_clarity",
      definitionURL: input.definition.url,
      settingsURL: input.settings.url,
      currentVersionURL: input.currentVersion.url,
      identityCrosswalk: identities,
      reviewedSources:
        reviewedSourcesOverride ??
        derivation?.reviewedSources ??
        sources.map(
          (source) =>
            projectionResults.find(
              (result) => result.contract.url === source.url,
            )?.contract.reviewedSource ?? source,
        ),
      sourceRenewalProjections: projectionResults.map(
        (result) => result.contract,
      ),
      sourceProjectionProofs: projectionProofs,
      derivation: derivation?.proof,
    },
    historicalSources: input.historicalSources,
    localCoverage: {
      scope: "san_jose",
      status: pending.length ? "pending" : "verified",
      expectedCandidates: pending.length
        ? null
        : races.reduce((n, r) => n + r.members.length, 0),
      expectedRaces: pending.length ? null : races.length,
      pendingRaces: pending.length,
      pendingCandidates: observedMembers.filter((m) =>
        pending.some((e) => e.sourceContestId === m.sourceContestId),
      ).length,
      notes: pending.length
        ? "Some local electoral territories remain unresolved. This is a verified subset, not complete San José coverage."
        : "All current county local contests reconciled against the reviewed electoral territory crosswalk. This union is not an address-specific ballot.",
    },
  });
}

export function decodeClarityXmlZip(bytes: Uint8Array, url: string) {
  if (
    !/^https:\/\/results\.enr\.clarityelections\.com\/CA\/Santa_Clara\/127570\/\d{6}\/reports\/detailwithoutvotetypesxml\.zip$/.test(
      url,
    )
  )
    throw new Error("Unsupported Clarity ZIP source");
  const buffer = Buffer.from(bytes);
  if (buffer.length > 10_000_000)
    throw new Error("Clarity ZIP exceeds byte bound");
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (
    end < 0 ||
    buffer.readUInt16LE(end + 10) !== 1 ||
    buffer.readUInt16LE(end + 8) !== 1
  )
    throw new Error("Clarity ZIP must contain one XML entry");
  const central = buffer.readUInt32LE(end + 16);
  if (
    central + 46 > buffer.length ||
    buffer.readUInt32LE(central) !== 0x02014b50
  )
    throw new Error("Invalid Clarity ZIP directory");
  const method = buffer.readUInt16LE(central + 10),
    compressed = buffer.readUInt32LE(central + 20),
    size = buffer.readUInt32LE(central + 24),
    nameLength = buffer.readUInt16LE(central + 28),
    offset = buffer.readUInt32LE(central + 42);
  const name = buffer
    .subarray(central + 46, central + 46 + nameLength)
    .toString("utf8");
  if (
    name !== "detailwithoutvotetypes.xml" ||
    size > 5_000_000 ||
    buffer.readUInt16LE(central + 8) & 1 ||
    offset + 30 > buffer.length ||
    buffer.readUInt32LE(offset) !== 0x04034b50
  )
    throw new Error("Invalid or oversized Clarity XML entry");
  const start =
    offset +
    30 +
    buffer.readUInt16LE(offset + 26) +
    buffer.readUInt16LE(offset + 28);
  if (start + compressed > central)
    throw new Error("Truncated Clarity ZIP entry");
  const data = buffer.subarray(start, start + compressed);
  const xml =
    method === 8
      ? inflateRawSync(data, { maxOutputLength: 5_000_000 })
      : method === 0
        ? data
        : null;
  if (!xml || xml.length !== size)
    throw new Error("Unsupported or corrupt Clarity ZIP compression");
  let crc = 0xffffffff;
  for (const byte of xml) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  if ((crc ^ 0xffffffff) >>> 0 !== buffer.readUInt32LE(central + 16))
    throw new Error("Clarity XML CRC mismatch");
  return new TextDecoder("utf-8", { fatal: true }).decode(xml);
}

function verifiedHistoricalAliasBasis(
  input: ClarityRosterInput,
  scope: ReturnType<typeof sanJoseScopeCrosswalkSchema.parse>,
  identities: ClarityCandidateCrosswalk,
) {
  const archive = input.historicalSources?.find(
    (source) => source.contentHash === scope.rosterSourceHash,
  );
  if (!archive || archive.format !== "pdf") return false;
  const url = new URL(archive.url);
  if (
    url.origin !== "https://files.santaclaracounty.gov" ||
    !/^\/.*\/2026-09\/qualified-list-of-local-candidates[^/]*\.pdf$/.test(
      url.pathname,
    )
  )
    return false;
  const county = parseSantaClaraQualifiedRoster(archive);
  const codes = new Set(county.map((contest) => contest.sourceContestId));
  if (
    codes.size !== scope.entries.length ||
    scope.entries.some((entry) => !codes.has(entry.sourceContestId))
  )
    throw new Error(
      "Historical county alias basis does not match the complete scope ledger",
    );
  for (const contest of county) {
    const entry = scope.entries.find(
      (entry) => entry.sourceContestId === contest.sourceContestId,
    )!;
    if ((entry.status === "off_ballot") === contest.onBallot)
      throw new Error(
        "Historical county ballot classification differs from the reviewed scope ledger",
      );
  }
  const printed = identities.members.filter(
    (member) => member.status === "on_ballot",
  );
  const expected = county
    .filter((contest) => contest.onBallot)
    .flatMap((contest) =>
      contest.members.map((member) => ({
        code: contest.sourceContestId,
        ...member,
      })),
    );
  if (printed.length !== expected.length)
    throw new Error("Historical county alias basis membership is incomplete");
  const aliasKeys = new Set(
    printed.map(
      (member) => `${member.sourceContestId}:${member.sourceOrdinal}`,
    ),
  );
  if (
    aliasKeys.size !== expected.length ||
    expected.some(
      (record) => !aliasKeys.has(`${record.code}:${record.sourceOrdinal}`),
    )
  )
    throw new Error(
      "Historical county PDF row aliases are not a complete reviewed bijection",
    );
  return true;
}
function clarityInputFromSources(
  sources: ResearchSource[],
  scopeCrosswalk: unknown,
  identityCrosswalk: unknown,
  historicalSources?: ResearchSource[],
): ClarityRosterInput {
  const currentVersion = sources.find(
    (s) => s.url === `${root}current_ver.txt`,
  );
  if (!currentVersion)
    throw new Error("Clarity source version archive missing");
  const version = currentVersion.text.trim();
  const definition = sources.find(
    (s) => s.url === `${root}${version}/json/en/summary.json`,
  );
  const settings = sources.find(
    (s) => s.url === `${root}${version}/json/en/electionsettings.json`,
  );
  if (
    !definition ||
    !settings ||
    new Set(sources.map((s) => s.url)).size !== sources.length
  )
    throw new Error("Clarity source archives missing or duplicated");
  return {
    definition,
    settings,
    currentVersion,
    proofSources: sources.filter(
      (s) =>
        ![definition.url, settings.url, currentVersion.url].includes(s.url),
    ),
    scopeCrosswalk,
    identityCrosswalk,
    historicalSources,
  };
}
function semanticClarityDefinition(
  input: ClarityRosterInput,
  aliases: Map<string, ClarityCandidateCrosswalk["members"][number]>,
) {
  const version = input.currentVersion.text.trim();
  const xmlSource = input.proofSources.find(
    (s) => s.url === `${root}${version}/reports/detailwithoutvotetypesxml.zip`,
  );
  if (!xmlSource)
    throw new Error("Clarity XML archive missing from semantic comparison");
  const rawRows = JSON.parse(input.definition.text) as Record<
    string,
    unknown
  >[];
  const rows = definitionSchema.parse(rawRows);
  const tallyFields = new Set([
    "regvoters",
    "BCxContest",
    "TP",
    "PR",
    "TV",
    "BC",
    "RC",
    "RO",
    "PCT",
    "V",
    "RCVRoundVGain",
    "RCVRoundPCTGain",
    "T",
    "RCVExhaustedBallots",
    "RCVBallotsCast",
    "W",
    "CRC",
    "CRO",
    "CumulativeVotes",
    "CumulativePercentages",
    "RCVAwaitingResults",
    "RCVRounds",
  ]);
  const modeledFields = new Set(["K", "C", "CAT", "VF", "CH", "P"]);
  const $ = load(xmlSource.text, { xmlMode: true });
  const contests = new Map<string, ReturnType<typeof $>>();
  $("Contest").each((_, element) => {
    const contest = $(element),
      key = contest.attr("key");
    if (!key || contests.has(key))
      throw new Error("Duplicate Clarity XML contest");
    contests.set(key, contest);
  });
  if (
    contests.size !== rows.length ||
    new Set(rows.map((r) => r.K)).size !== rows.length
  )
    throw new Error("Clarity complete contest context mismatch");
  const choiceIndex = new Map<string, number>();
  const semantics = rows
    .map((row) => {
      const contest = contests.get(row.K);
      if (
        !contest ||
        contest.attr("text") !== row.C ||
        Number(contest.attr("voteFor")) !== row.VF
      )
        throw new Error("Clarity semantic contest context mismatch");
      const choices = contest.children("Choice");
      if (choices.length !== row.CH.length || row.P.length !== row.CH.length)
        throw new Error("Clarity semantic choice count mismatch");
      const seen = new Set<string>();
      const members = choices
        .toArray()
        .map((element, index) => {
          const choice = $(element),
            key = choice.attr("key"),
            name = choice.attr("text")?.replaceAll('""', '"');
          if (
            !key ||
            !/^[0-9]+$/.test(key) ||
            seen.has(key) ||
            name !== row.CH[index]?.replaceAll("''", '"')
          )
            throw new Error("Clarity semantic candidate context mismatch");
          seen.add(key);
          choiceIndex.set(`${row.K}:${key}`, index);
          const precincts = choice
            .children("Precinct")
            .toArray()
            .map((element) => {
              const precinct = $(element);
              return Object.fromEntries(
                Object.entries(precinct.attr() ?? {}).filter(
                  ([key]) =>
                    !["Registered_Voters", "Total_Votes"].includes(key),
                ),
              );
            })
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
          if (new Set(precincts.map((p) => p.name)).size !== precincts.length)
            throw new Error("Duplicate Clarity contest precinct routing");
          const choiceAttributes = Object.fromEntries(
            Object.entries(choice.attr() ?? {}).filter(
              ([key]) => !["totalVotes", "key", "text", "party"].includes(key),
            ),
          );
          const alias = aliases.get(`${row.K}:${key}`);
          return {
            choiceKey: key,
            name,
            party: row.P[index],
            status:
              alias?.status ??
              (name === "Write-in"
                ? "generic_write_in_option"
                : "source_option"),
            pdfAliases: alias
              ? {
                  sourceContestId: alias.sourceContestId,
                  sourceOrdinal: alias.sourceOrdinal,
                  officialCandidateId: alias.officialCandidateId ?? null,
                }
              : null,
            precincts,
            choiceAttributes,
          };
        })
        .sort((a, b) => a.choiceKey.localeCompare(b.choiceKey));
      return {
        key: row.K,
        title: row.C,
        category: row.CAT,
        voteFor: row.VF,
        isQuestion: contest.attr("isQuestion"),
        attributes: Object.fromEntries(
          Object.entries(contest.attr() ?? {}).filter(
            ([key]) =>
              ![
                "precinctsReporting",
                "precinctsReported",
                "key",
                "text",
                "voteFor",
                "isQuestion",
              ].includes(key),
          ),
        ),
        metadata: Object.fromEntries(
          Object.entries(rawRows.find((raw) => raw.K === row.K)!).filter(
            ([key]) => !tallyFields.has(key) && !modeledFields.has(key),
          ),
        ),
        members,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  return {
    digest: hash(
      canonical({
        electionDate: $("ElectionDate").text(),
        electionName: $("ElectionName").text(),
        region: $("Region").text(),
        contests: semantics,
      }),
    ),
    choiceIndex,
  };
}
function originalClarityAliases(
  input: ClarityRosterInput,
  identities: ClarityCandidateCrosswalk,
) {
  const version = input.currentVersion.text.trim();
  const xml = input.proofSources.find(
    (s) => s.url === `${root}${version}/reports/detailwithoutvotetypesxml.zip`,
  );
  if (!xml) throw new Error("Reviewed Clarity XML archive missing");
  const $ = load(xml.text, { xmlMode: true });
  const aliases = new Map<
    string,
    ClarityCandidateCrosswalk["members"][number]
  >();
  const contests = new Map<string, ReturnType<typeof $>>();
  $("Contest").each((_, element) => {
    const contest = $(element);
    contests.set(contest.attr("key")!, contest);
  });
  for (const member of identities.members) {
    const key = contests
      .get(member.clarityContestKey)
      ?.children("Choice")
      .eq(member.clarityChoiceIndex)
      .attr("key");
    if (!key) throw new Error("Reviewed Clarity choice identity missing");
    const identity = `${member.clarityContestKey}:${key}`;
    if (aliases.has(identity))
      throw new Error("Reviewed Clarity identity duplicated");
    aliases.set(identity, member);
  }
  return aliases;
}
export function renewReviewedClaritySanJoseRoster(
  current: CaliforniaRosterSnapshot,
  state: CaliforniaRosterSnapshot,
  freshSources: ResearchSource[],
  checkedAt = new Date().toISOString(),
): CaliforniaRosterSnapshot {
  const primary = current.localPrimary;
  if (!primary || !current.localCrosswalk)
    throw new Error("Clarity reviewed snapshot metadata missing");
  const reviewedSources =
    primary.reviewedSources ?? current.additionalSources ?? [];
  const original = clarityInputFromSources(
    reviewedSources,
    current.localCrosswalk,
    primary.identityCrosswalk,
    current.historicalSources,
  );
  appendReviewedClaritySanJoseRoster(state, original);
  const observed = clarityInputFromSources(
    freshSources,
    current.localCrosswalk,
    primary.identityCrosswalk,
    current.historicalSources,
  );
  observed.sourceRenewalProjections = primary.sourceRenewalProjections;
  const aliases = originalClarityAliases(original, primary.identityCrosswalk);
  const reviewedSemantic = semanticClarityDefinition(original, aliases),
    observedSemantic = semanticClarityDefinition(observed, aliases);
  if (reviewedSemantic.digest !== observedSemantic.digest)
    throw new Error(
      "Clarity candidate, office, status, or precinct routing changed; new scope and identity review required",
    );
  const freshByURL = new Map(
    freshSources.map((source) => [source.url, source]),
  );
  const proofMap = new Map<
    string,
    { url: string; contentHash: string; byteHash?: string }
  >();
  const oldVersion = original.currentVersion.text.trim(),
    newVersion = observed.currentVersion.text.trim();
  const reportPaths = [
    "json/en/summary.json",
    "json/en/electionsettings.json",
    "reports/detailwithoutvotetypesxml.zip",
  ];
  for (const reviewed of reviewedSources) {
    const reportPath = reportPaths.find(
      (path) => reviewed.url === `${root}${oldVersion}/${path}`,
    );
    const freshURL = reportPath
      ? `${root}${newVersion}/${reportPath}`
      : reviewed.url;
    const fresh = freshByURL.get(freshURL);
    if (!fresh || hash(fresh.text) !== fresh.contentHash)
      throw new Error("Fresh Clarity or territorial proof archive missing");
    const projection = primary.sourceRenewalProjections?.find(
      (projection) => projection.url === reviewed.url,
    );
    if (projection)
      validateAuthorityRenewalProjection(
        projection,
        fresh,
        current.localCrosswalk.review.digest,
      );
    if (
      !projection &&
      !reportPath &&
      reviewed.url !== `${root}current_ver.txt` &&
      fresh.contentHash !== reviewed.contentHash
    )
      throw new Error(
        `Territorial proof changed (${reviewed.id}); new San José scope review required`,
      );
    const strongRefs = current.localCrosswalk.entries
      .flatMap((entry) => entry.proofs)
      .filter(
        (ref) =>
          ref.url === reviewed.url &&
          ref.contentHash === reviewed.contentHash &&
          ref.byteHash,
      );
    if (
      !reportPath &&
      strongRefs.some((ref) => fresh.byteHash !== ref.byteHash)
    )
      throw new Error(
        "Territorial proof raw bytes changed; new scope review required",
      );
    const observedRef = {
      url: fresh.url,
      contentHash: fresh.contentHash,
      ...(fresh.byteHash ? { byteHash: fresh.byteHash } : {}),
    };
    proofMap.set(`${reviewed.url}:${reviewed.contentHash}:`, observedRef);
    if (reviewed.byteHash)
      proofMap.set(
        `${reviewed.url}:${reviewed.contentHash}:${reviewed.byteHash}`,
        observedRef,
      );
  }
  const observedRows = definitionSchema.parse(
    JSON.parse(observed.definition.text),
  );
  const observedMembers = [...aliases].map(([key, member]) => {
    const index = observedSemantic.choiceIndex.get(key);
    if (index === undefined)
      throw new Error("Observed Clarity identity missing");
    const row = observedRows.find((row) => row.K === member.clarityContestKey)!;
    return { ...member, clarityChoiceIndex: index, name: row.CH[index]! };
  });
  const signature = (sources: ResearchSource[]) =>
    canonical(
      sources
        .map((source) => ({
          url: source.url,
          contentHash:
            primary.sourceRenewalProjections?.find(
              (projection) => projection.url === source.url,
            )?.canonicalDigest ?? source.contentHash,
        }))
        .sort((a, b) => a.url.localeCompare(b.url)),
    );
  const unchanged =
    signature(freshSources) === signature(current.additionalSources ?? []);
  if (!primary.derivation && unchanged)
    return compileClaritySanJoseRoster(
      state,
      observed,
      undefined,
      reviewedSources,
    );
  const proof: ClarityRosterDerivation =
    unchanged && primary.derivation
      ? primary.derivation
      : {
          algorithmVersion: "scc-clarity-semantic-v1",
          fromSnapshotId: current.id,
          reviewedDefinitionHash: original.definition.contentHash,
          observedDefinitionHash: observed.definition.contentHash,
          semanticDigest: observedSemantic.digest,
          checkedAt,
        };
  return compileClaritySanJoseRoster(state, observed, {
    proof,
    members: observedMembers,
    reviewedSources,
    proofMap,
  });
}
