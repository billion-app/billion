import { createHash } from "node:crypto";

import type {
  CandidateBrief,
  CandidateEvidenceDossier,
} from "@acme/validators";
import {
  candidateDossierSemanticProjection,
  candidateDossierSourceProjection,
  candidateEvidenceDossierSchema,
  candidateFinanceSemanticProjection,
  validateCampaignContactDestination,
} from "@acme/validators";

export const californiaResearchVersion = "california-dossier-v1";
export const evidenceDigest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function validateCaliforniaDossier(
  value: unknown,
): CandidateEvidenceDossier {
  const dossier = candidateEvidenceDossierSchema.parse(value);
  validateCampaignContactDestination(dossier);
  const sources = new Map(dossier.sources.map((source) => [source.id, source]));
  if (sources.size !== dossier.sources.length)
    throw new Error("Duplicate dossier sources");
  if (
    new Set(dossier.evidence.map((entry) => entry.id)).size !==
    dossier.evidence.length
  )
    throw new Error("Duplicate dossier evidence");
  let bytes = 0;
  for (const source of dossier.sources) {
    bytes +=
      Buffer.byteLength(source.text) +
      (source.binaryBase64
        ? Buffer.byteLength(source.binaryBase64, "base64")
        : 0);
    if (bytes > 2_000_000)
      throw new Error("Dossier exceeds source byte budget");
    if (
      source.binaryBase64 &&
      (!source.byteHash ||
        createHash("sha256")
          .update(Buffer.from(source.binaryBase64, "base64"))
          .digest("hex") !== source.byteHash)
    )
      throw new Error("Binary source archive hash mismatch");
    if (
      createHash("sha256").update(source.text).digest("hex") !==
      source.contentHash
    )
      throw new Error("Source hash mismatch");
  }
  if (bytes > 2_000_000) throw new Error("Dossier exceeds source byte budget");
  for (const link of dossier.sourceLinks ?? []) {
    const from = sources.get(link.fromSourceId);
    const to = sources.get(link.toSourceId);
    if (
      !from ||
      !to ||
      to.url !== link.url ||
      !from.text.includes(link.anchorText)
    )
      throw new Error(
        "Source discovery link must bind exact archived sources, URL and anchor text",
      );
    if (
      link.relation === "same_origin_campaign" &&
      new URL(from.url).origin !== new URL(to.url).origin
    )
      throw new Error(
        "Campaign child discovery must remain on the verified source origin",
      );
  }
  for (const entry of dossier.evidence) {
    const source = sources.get(entry.sourceId);
    if (source?.format === "image")
      throw new Error("Image archives cannot supply textual quote evidence");
    if (!source?.text.includes(entry.excerpt))
      throw new Error("Evidence must quote its archived source exactly");
    if (
      entry.identityQualification === "official_roster" &&
      entry.role !== "roster"
    )
      throw new Error(
        "Roster identity alone cannot qualify candidate research",
      );
    if (
      dossier.officeKind !== "federal_legislative" &&
      entry.role === "finance" &&
      /(^|\.)fec\.gov$/.test(new URL(source.url).hostname)
    )
      throw new Error(
        "FEC finance does not apply to state or local candidates",
      );
  }
  for (const gap of dossier.gaps)
    if (gap.checkedSourceIds.some((id) => !sources.has(id)))
      throw new Error("Gap references unknown source");
  if (!dossier.evidence.some((entry) => entry.role === "roster"))
    throw new Error("Dossier needs official roster evidence");
  if (dossier.financeIdentityProof) {
    const proof = dossier.financeIdentityProof;
    const source = sources.get(proof.sourceId);
    const district =
      dossier.identity.jurisdiction.match(/\/cd:(\d+)(?:\/|$)/)?.[1];
    const normalize = (name: string) =>
      name
        .normalize("NFKC")
        .toUpperCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    let rows: Record<string, unknown>[] = [];
    try {
      const parsed = JSON.parse(source?.text ?? "") as { results?: unknown };
      if (Array.isArray(parsed.results))
        rows = parsed.results.filter(
          (row): row is Record<string, unknown> =>
            !!row && typeof row === "object",
        );
    } catch {
      throw new Error(
        "FEC identity proof requires an archived official JSON candidate index",
      );
    }
    const matching = rows.filter(
      (row) => row.candidate_id === proof.candidateId,
    );
    const row = matching[0];
    if (
      matching.length !== 1 ||
      !row ||
      row.name !== proof.name ||
      row.office !== "H" ||
      row.state !== "CA" ||
      Number(row.district) !== Number(proof.district) ||
      !Array.isArray(row.cycles) ||
      !row.cycles.includes(proof.cycle) ||
      !Array.isArray(row.election_years) ||
      !row.election_years.includes(proof.cycle)
    )
      throw new Error(
        "FEC identity proof must match exactly one archived official index row",
      );
    const comma = proof.name.indexOf(",");
    const fecName =
      comma >= 0
        ? `${proof.name.slice(comma + 1)} ${proof.name.slice(0, comma)}`
        : proof.name;
    if (
      dossier.officeKind !== "federal_legislative" ||
      !source ||
      source.contentHash !== proof.sourceHash ||
      new URL(source.url).hostname !== "api.open.fec.gov" ||
      !district ||
      Number(proof.district) !== Number(district) ||
      proof.cycle !== Number(dossier.identity.electionDate.slice(0, 4)) ||
      normalize(fecName) !== normalize(dossier.name)
    )
      throw new Error(
        "FEC identity proof does not match this candidate and archived official index",
      );
  }
  if (dossier.finance) {
    if (dossier.officeKind !== "federal_legislative")
      throw new Error(
        "Typed finance adapter currently supports federal candidates only",
      );
    const financeRefs = [
      ...dossier.finance.filingEvidenceIds,
      ...dossier.finance.donors.flatMap((donor) => donor.evidenceIds),
      ...(dossier.finance.outsideSpending?.flatMap(
        (entry) => entry.evidenceIds,
      ) ?? []),
    ];
    if (
      financeRefs.some(
        (id) =>
          !dossier.evidence.some(
            (entry) =>
              entry.id === id &&
              entry.role === "finance" &&
              entry.origin === "primary_record",
          ),
      )
    )
      throw new Error("Typed finance needs qualified primary finance evidence");
  }
  const hasCandidateResearch = dossier.evidence.some((entry) =>
    ["candidate_statement", "candidate_record", "campaign_material"].includes(
      entry.role,
    ),
  );
  if (
    dossier.classification !==
    (hasCandidateResearch ? "supported" : "evidence_gap")
  )
    throw new Error(
      "Research classification must reflect candidate-specific evidence",
    );
  const sourceSetDigest = evidenceDigest(
    candidateDossierSourceProjection(dossier.sources),
  );
  if (sourceSetDigest !== dossier.sourceSetDigest)
    throw new Error("Wrong source-set digest");
  if (
    evidenceDigest(candidateDossierSemanticProjection(dossier)) !==
    dossier.dossierDigest
  )
    throw new Error("Wrong dossier digest");
  return dossier;
}

export function buildCaliforniaDossier(
  input: Omit<
    CandidateEvidenceDossier,
    "schemaVersion" | "classification" | "sourceSetDigest" | "dossierDigest"
  >,
): CandidateEvidenceDossier {
  const sourceSetDigest = evidenceDigest(
    candidateDossierSourceProjection(input.sources),
  );
  const classification = input.evidence.some((entry) =>
    ["candidate_statement", "candidate_record", "campaign_material"].includes(
      entry.role,
    ),
  )
    ? ("supported" as const)
    : ("evidence_gap" as const);
  const parsed = candidateEvidenceDossierSchema.parse({
    ...input,
    schemaVersion: 1,
    classification,
    sourceSetDigest,
    dossierDigest: "0".repeat(64),
  });
  return validateCaliforniaDossier({
    ...input,
    schemaVersion: 1,
    classification,
    sourceSetDigest,
    dossierDigest: evidenceDigest(candidateDossierSemanticProjection(parsed)),
  });
}

export function validateBriefAgainstDossier(
  brief: CandidateBrief,
  dossierInput: CandidateEvidenceDossier,
): void {
  const dossier = validateCaliforniaDossier(dossierInput);
  if (JSON.stringify(brief.identity) !== JSON.stringify(dossier.identity))
    throw new Error("Brief identity differs from dossier");
  if (
    dossier.gaps.some(
      (gap) =>
        gap.required &&
        ["source_unavailable", "identity_unresolved"].includes(gap.code),
    )
  )
    throw new Error("Required source or identity remains unresolved");
  for (const gap of dossier.gaps) {
    const disclosure =
      gap.dimension === "finance"
        ? (brief.research?.financeGap ??
          brief.sections.find((section) => section.topic === "unknowns")
            ?.missingEvidence)
        : brief.sections.find((section) => section.topic === gap.dimension)
            ?.missingEvidence;
    if (!disclosure)
      throw new Error("Brief must disclose every dossier evidence gap");
  }
  if (
    JSON.stringify(
      candidateFinanceSemanticProjection(brief.research?.finance ?? null),
    ) !==
    JSON.stringify(candidateFinanceSemanticProjection(dossier.finance ?? null))
  )
    throw new Error(
      "Brief finance must equal the trusted typed dossier record",
    );
  if (brief.research?.finance) {
    const financeIds = new Set(
      dossier.evidence
        .filter((entry) => entry.role === "finance")
        .map((entry) => entry.id),
    );
    if (
      brief.research.finance.filingEvidenceIds.some((id) => !financeIds.has(id))
    )
      throw new Error("Finance must cite qualified finance records");
  }
  for (const claim of brief.sections.flatMap((section) => section.claims)) {
    if (
      claim.kind === "disputed" &&
      !claim.evidenceIds.some((id) =>
        dossier.evidence.some(
          (entry) =>
            entry.id === id &&
            entry.role === "candidate_record" &&
            ["primary_record", "reporting"].includes(entry.origin),
        ),
      )
    )
      throw new Error(
        "Disputed claims require candidate-specific conflicting record or reporting; unverified campaign assertions are not disputes",
      );
  }
  for (const evidence of brief.evidence) {
    const selected = dossier.evidence.find((entry) => entry.id === evidence.id);
    const source =
      selected && dossier.sources.find((item) => item.id === selected.sourceId);
    if (
      !selected ||
      !source ||
      evidence.excerpt !== selected.excerpt ||
      evidence.contentHash !== source.contentHash ||
      evidence.url !== source.url ||
      evidence.origin !== selected.origin ||
      JSON.stringify(evidence.attribution ?? null) !==
        JSON.stringify(selected.attribution ?? null)
    )
      throw new Error("Brief evidence differs from immutable dossier");
  }
  if (
    dossier.classification === "evidence_gap" &&
    brief.sections.some((section) =>
      section.claims.some((claim) => claim.kind === "promise"),
    )
  )
    throw new Error("Evidence-gap dossier cannot invent promises");
  if (
    ["judicial_retention", "judicial_election"].includes(dossier.officeKind) &&
    brief.sections.some((section) =>
      section.claims.some((claim) => claim.kind === "promise"),
    )
  )
    throw new Error("Judicial research cannot invent policy promises");
  if (
    dossier.officeKind !== "federal_legislative" &&
    brief.research?.finance &&
    dossier.evidence.some(
      (entry) =>
        entry.role === "finance" &&
        /(^|\.)fec\.gov$/.test(
          new URL(
            dossier.sources.find((source) => source.id === entry.sourceId)!.url,
          ).hostname,
        ),
    )
  )
    throw new Error("Wrong finance jurisdiction");
}
