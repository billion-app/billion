import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { z } from "zod/v4";

import {
  candidateDossierSemanticProjection,
  candidateDossierSourceProjection,
  candidateEvidenceDossierSchema,
} from "@acme/validators";

import {
  validateStoredCampaignContactProof,
  verifyStoredCampaignContactProof,
} from "./california-campaign-contact";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const read = (name: string) =>
  readFileSync(
    new URL(
      `../../../../apps/scraper/src/candidate-research/fixtures/${name}`,
      import.meta.url,
    ),
    "utf8",
  );
const rows = z
  .array(
    z.object({
      pdfContestCode: z.string(),
      pdfCandidateOrdinal: z.string().nullable(),
      writeInSourceCandidateID: z.string().optional(),
      pdfName: z.string(),
      clarityContestKey: z.string(),
      clarityChoiceIndex0: z.number(),
      clarityChoiceName: z.string(),
      clarityXMLChoiceKey: z.string(),
      verifiedSourceScopedIdentity: z.string(),
      status: z.string(),
    }),
  )
  .parse(JSON.parse(read("scc-clarity-memberships-2026.json")));
function required<T>(value: T | undefined): T {
  assert.ok(value);
  return value;
}
function fixture(name = "Anne J. Kepner") {
  const row = required(
      rows.find((candidate) => candidate.clarityChoiceName === name),
    ),
    writeIn = row.status === "qualified_write_in";
  const url = writeIn
    ? "https://files.santaclaracounty.gov/exjcpb1296/2026-10/writeincandidates_102026-v3.pdf?VersionId=XSwtnLJSbo6VZ5rS3.DHdgMF040jZKp."
    : "https://files.santaclaracounty.gov/exjcpb1296/2026-09/qualified-list-of-local-candidates-9-28-26.pdf?VersionId=CM6jbwAVTLFIjLakj6hJku2l9KPAIxli";
  const text = read(
      writeIn ? "scc-writeins-2026.txt" : "scc-qualified-2026.txt",
    ),
    source = {
      id: "historical-qualified",
      url,
      publisher: "County of Santa Clara Registrar of Voters",
      format: "pdf" as const,
      text,
      contentHash: hash(text),
      fetchedAt: "2026-10-20T16:30:08.000Z",
    };
  const identity = {
    candidateId: row.verifiedSourceScopedIdentity,
    contestId: `ca-scc-clarity:2026-11-03:127570:${row.clarityContestKey}`,
    jurisdiction: `fixture:${row.pdfContestCode}`,
    electionDate: "2026-11-03",
  };
  const member = {
    identity,
    candidateId: identity.candidateId,
    sourceCandidateId: row.clarityXMLChoiceKey,
    name: row.clarityChoiceName,
    partyCode: "",
    party: null,
    ballotStatus: writeIn ? "qualified_write_in" : "on_ballot",
  };
  const alias = {
    sourceContestId: row.pdfContestCode,
    sourceOrdinal:
      row.pdfCandidateOrdinal ?? `write-in:${row.writeInSourceCandidateID}`,
    clarityContestKey: row.clarityContestKey,
    clarityChoiceIndex: row.clarityChoiceIndex0,
    name: row.clarityChoiceName,
    status: member.ballotStatus,
  };
  const review = {
    actorId: "fixture-reviewed-mapping",
    digest: "a".repeat(64),
    reviewedAt: "2026-10-30T00:00:00.000Z",
  };
  const context = {
    kind: "scc_clarity",
    memberships: [
      { sourceContestId: row.pdfContestCode, officeFamily: "local", member },
    ],
    aliases: [alias],
    archives: [source],
    rosterSourceHash: source.contentHash,
    membershipReview: review,
    scopeReview: review,
    qualifications: [
      {
        sourceContestId: row.pdfContestCode,
        proofs: [
          {
            url: source.url,
            contentHash: source.contentHash,
            role: "historical_qualification",
          },
        ],
      },
    ],
  };
  const marker = `Qualified ${row.pdfCandidateOrdinal} ${row.pdfName} Candidate Stmt Filed?`;
  const start = text.indexOf(marker),
    tail = text.slice(start + 1);
  const nextCandidate = /^Qualified \d+ /m.exec(tail),
    nextContest = /^\d{4} .+? On Ballot: /m.exec(tail);
  const end =
    start < 0
      ? 0
      : Math.min(
          nextCandidate ? start + 1 + nextCandidate.index : text.length,
          nextContest ? start + 1 + nextContest.index : text.length,
        );
  const block = start < 0 ? "" : text.slice(start, end),
    field = /^Website:([^\n]*)$/m.exec(block);
  const value = field?.[1]?.trim() ?? "hina.example",
    website = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
      ? value
      : `https://${value}`;
  const lineStart = text.slice(0, start).split("\n").length,
    fieldLine =
      lineStart + block.slice(0, field?.index ?? 0).split("\n").length - 1;
  const proof = {
    kind: "historical_official_filing" as const,
    identity,
    websiteUrl: website,
    destinationSourceId: "campaign",
    retrievalUrls: [website],
    officialSource: {
      url: source.url,
      contentHash: source.contentHash,
      fetchedAt: source.fetchedAt,
      locator: `Archived official filing; county contest ${row.pdfContestCode}, source ordinal ${alias.sourceOrdinal}; extracted record lines ${lineStart}-${text.slice(0, end).split("\n").length}; Website line ${fieldLine}`,
      excerpt: field?.[0] ?? "Website:hina.example",
      recordDigest: hash(block),
      officialRecordName: row.pdfName,
    },
  };
  return { context, proof, source, member, alias };
}

void test("historical campaign URL requires the exact reviewed candidate record, not another Website in the same PDF", () => {
  const { context, proof } = fixture();
  validateStoredCampaignContactProof(proof, context);
  assert.throws(
    () =>
      validateStoredCampaignContactProof(
        {
          ...proof,
          identity: { ...proof.identity, candidateId: "wrong-candidate" },
        },
        context,
      ),
    /identity/,
  );
  assert.throws(
    () =>
      validateStoredCampaignContactProof(
        { ...proof, websiteUrl: "https://another-candidate.example" },
        context,
      ),
    /Website field/,
  );
  assert.throws(
    () =>
      validateStoredCampaignContactProof(
        {
          ...proof,
          officialSource: {
            ...proof.officialSource,
            recordDigest: "b".repeat(64),
          },
        },
        context,
      ),
    /exact stored official candidate record/,
  );
  assert.throws(
    () =>
      validateStoredCampaignContactProof(
        {
          ...proof,
          officialSource: {
            ...proof.officialSource,
            excerpt: "Website:another-candidate.example",
          },
        },
        context,
      ),
    /exact stored official candidate record/,
  );
  assert.throws(
    () =>
      validateStoredCampaignContactProof(
        {
          ...proof,
          officialSource: {
            ...proof.officialSource,
            fetchedAt: "2026-10-30T00:00:00.000Z",
          },
        },
        context,
      ),
    /exact stored official candidate record/,
  );
  assert.throws(
    () =>
      validateStoredCampaignContactProof(proof, {
        ...context,
        rosterSourceHash: "b".repeat(64),
      }),
    /reviewed roster/,
  );
});
void test("qualified write-in contact metadata requires its specific official qualification proof", () => {
  const { context, proof } = fixture("Hina Patel");
  assert.throws(
    () =>
      validateStoredCampaignContactProof(proof, {
        ...context,
        qualifications: [],
      }),
    /candidate qualification proof/,
  );
  assert.throws(
    () => validateStoredCampaignContactProof(proof, context),
    /released Website field/,
  );
});
void test(
  "stored historical contact proof is rechecked against immutable server archive and reviewed mapping",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async () => {
    const value = required(process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL),
      target = new URL(value);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.endsWith("_test"),
    );
    process.env.POSTGRES_URL = value;
    const { db } = await import("@acme/db/client");
    const { eq } = await import("@acme/db");
    const { CaliforniaRoster } = await import("@acme/db/schema");
    const f = fixture(),
      id = hash(randomUUID()),
      now = new Date().toISOString();
    const campaign = {
      id: "campaign",
      url: f.proof.websiteUrl,
      publisher: "Candidate campaign",
      format: "html" as const,
      text: "Anne J. Kepner for local office.",
      contentHash: hash("Anne J. Kepner for local office."),
      fetchedAt: now,
      retrievalUrls: f.proof.retrievalUrls,
    };
    const dossier = candidateEvidenceDossierSchema.parse({
      schemaVersion: 1,
      identity: f.proof.identity,
      name: f.member.name,
      officeFamily: "local",
      officeKind: "local",
      rosterDigest: "a".repeat(64),
      researchVersion: "fixture",
      createdAt: now,
      campaignContactProof: f.proof,
      sources: [campaign],
      evidence: [
        {
          id: "campaign",
          sourceId: campaign.id,
          excerpt: campaign.text,
          locator: "Campaign home page",
          origin: "candidate",
          role: "candidate_statement",
          identityQualification: "official_cross_link",
        },
      ],
      gaps: [],
      classification: "supported",
      sourceSetDigest: hash(
        JSON.stringify(candidateDossierSourceProjection([campaign])),
      ),
      dossierDigest: "0".repeat(64),
    });
    dossier.dossierDigest = hash(
      JSON.stringify(candidateDossierSemanticProjection(dossier)),
    );
    const document = {
      races: [
        {
          sourceContestId: f.context.memberships[0]?.sourceContestId,
          officeFamily: "local",
          contestId: f.proof.identity.contestId,
          jurisdiction: f.proof.identity.jurisdiction,
          electionDate: f.proof.identity.electionDate,
          members: [f.member],
        },
      ],
      localPrimary: {
        kind: "scc_clarity",
        identityCrosswalk: {
          members: [f.alias],
          review: f.context.membershipReview,
        },
      },
      localCrosswalk: {
        rosterSourceHash: f.context.rosterSourceHash,
        entries: f.context.qualifications,
        review: f.context.scopeReview,
      },
      historicalSources: [f.source],
    };
    try {
      await db.insert(CaliforniaRoster).values({
        id,
        electionDate: f.proof.identity.electionDate,
        document: document as never,
      });
      await db.transaction((tx) =>
        verifyStoredCampaignContactProof(tx, id, dossier),
      );
      const changed = {
        ...document,
        localCrosswalk: {
          ...document.localCrosswalk,
          rosterSourceHash: "b".repeat(64),
        },
      };
      await db
        .update(CaliforniaRoster)
        .set({ document: changed as never })
        .where(eq(CaliforniaRoster.id, id));
      await assert.rejects(
        db.transaction((tx) =>
          verifyStoredCampaignContactProof(tx, id, dossier),
        ),
        /reviewed roster/,
      );
    } finally {
      await db.delete(CaliforniaRoster).where(eq(CaliforniaRoster.id, id));
    }
  },
);
