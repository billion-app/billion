import { createHash } from "node:crypto";
import { z } from "zod/v4";

import type { CandidateEvidenceDossier } from "@acme/validators";
import { eq, sql } from "@acme/db";
import { CaliforniaRoster } from "@acme/db/schema";
import {
  californiaRaceTargetSchema,
  campaignContactProofSchema,
  canonicalCampaignContactUrl,
  clarityCandidateCrosswalkSchema,
  researchSourceSchema,
  validateCampaignContactDestination,
} from "@acme/validators";

import type { ResearchTransaction } from "./candidate-research-store";
import { briefIdentityKey } from "./candidate-brief-publication";

const review = z.object({
  actorId: z.string().min(1),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  reviewedAt: z.iso.datetime(),
});
export const storedCampaignContactContextSchema = z.object({
  kind: z.literal("scc_clarity"),
  memberships: z
    .array(
      z.object({
        sourceContestId: z.string(),
        officeFamily: z.literal("local"),
        member: californiaRaceTargetSchema.shape.members.element,
      }),
    )
    .length(1),
  aliases: z
    .array(clarityCandidateCrosswalkSchema.shape.members.element)
    .max(1000),
  archives: z.array(researchSourceSchema).length(1),
  rosterSourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  membershipReview: review,
  scopeReview: review,
  qualifications: z
    .array(
      z.object({
        sourceContestId: z.string(),
        proofs: z.array(
          z.object({
            url: z.url(),
            contentHash: z.string(),
            role: z.string().optional(),
          }),
        ),
      }),
    )
    .max(129),
});
type StoredContactContext = z.infer<typeof storedCampaignContactContextSchema>;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
interface FilingRecord {
  name: string;
  header: string;
  block: string;
  start: number;
  end: number;
}
function officialRecord(
  text: string,
  contestId: string,
  ordinal: string,
): FilingRecord {
  const records: FilingRecord[] = [];
  if (ordinal.startsWith("write-in:")) {
    const heads = [
      ...text.matchAll(/^Candidate\(s\): (.+?) \(Write-in\)\s*$/gm),
    ];
    for (const [index, head] of heads.entries()) {
      const stop = /^Nonpartisan /m.exec(
        text.slice(head.index + head[0].length),
      );
      const end = Math.min(
        heads[index + 1]?.index ?? text.length,
        stop ? head.index + head[0].length + stop.index : text.length,
      );
      const block = text.slice(head.index, end);
      const contest = [
        ...text.slice(0, head.index).matchAll(/^\s*(\d{4}) [A-Za-z][^\n]*$/gm),
      ].at(-1);
      const id =
        /Cand ID:\s*\n(\d{1,2}\/\d{1,2}\/\d{4})\s*\n\s*(\d+)\s*\n/.exec(block);
      if (
        contest?.[1] === contestId &&
        id?.[2] === ordinal.slice("write-in:".length)
      )
        records.push({
          name: head[1] ?? "",
          header: head[0].trimEnd(),
          block,
          start: head.index,
          end,
        });
    }
  } else {
    const contests = [
      ...text.matchAll(
        /^(\d{4}) (.+?) On Ballot: (Yes|No) Vote For: (\d+)\s*$/gm,
      ),
    ];
    for (const [index, contest] of contests.entries()) {
      if (contest[1] !== contestId || contest[3] !== "Yes") continue;
      const end = contests[index + 1]?.index ?? text.length,
        start = contest.index + contest[0].length;
      const candidates = [
        ...text
          .slice(start, end)
          .matchAll(
            /^Qualified (\d+) (.+?) Candidate Stmt Filed\? (?:Yes|No)[^\n]*$/gm,
          ),
      ];
      for (const [candidateIndex, candidate] of candidates.entries()) {
        if (candidate[1] !== ordinal) continue;
        const recordStart = start + candidate.index,
          recordEnd = candidates[candidateIndex + 1]
            ? start + (candidates[candidateIndex + 1]?.index ?? 0)
            : end;
        records.push({
          name: candidate[2] ?? "",
          header: candidate[0],
          block: text.slice(recordStart, recordEnd),
          start: recordStart,
          end: recordEnd,
        });
      }
    }
  }
  const record = records[0];
  if (records.length !== 1 || !record)
    throw new Error(
      "Historical contact proof does not select exactly one official candidate record",
    );
  return record;
}
export function validateStoredCampaignContactProof(
  value: unknown,
  contextValue: unknown,
): void {
  const proof = campaignContactProofSchema.parse(value),
    context: StoredContactContext =
      storedCampaignContactContextSchema.parse(contextValue);
  const membership = context.memberships[0],
    archive = context.archives[0];
  if (!membership || !archive)
    throw new Error(
      "Historical contact proof is missing its stored membership or archive",
    );
  const member = membership.member;
  const id = /^ca-scc-clarity:2026-11-03:127570:(\d+):choice:(\d+)$/.exec(
    member.candidateId,
  );
  if (
    member.sourceCandidateId !== id?.[2] ||
    member.identity.contestId !== `ca-scc-clarity:2026-11-03:127570:${id[1]}` ||
    briefIdentityKey(proof.identity) !== briefIdentityKey(member.identity)
  )
    throw new Error(
      "Historical contact proof candidate identity is not the stored official membership",
    );
  const aliases = context.aliases.filter(
    (alias) =>
      alias.clarityContestKey === id[1] &&
      alias.sourceContestId === membership.sourceContestId &&
      alias.name === member.name &&
      alias.status === member.ballotStatus,
  );
  const alias = aliases[0];
  if (aliases.length !== 1 || !alias)
    throw new Error(
      "Historical contact proof needs one reviewed candidate ordinal mapping",
    );
  const writeIn = alias.sourceOrdinal.startsWith("write-in:");
  if (writeIn !== (member.ballotStatus === "qualified_write_in"))
    throw new Error(
      "Historical contact proof candidate ballot status conflicts with the reviewed mapping",
    );
  const url = new URL(archive.url),
    path = writeIn
      ? /\/writeincandidates_[^/]+\.pdf$/
      : /\/qualified-list-of-local-candidates-[^/]+\.pdf$/;
  if (
    url.protocol !== "https:" ||
    url.hostname !== "files.santaclaracounty.gov" ||
    !path.test(url.pathname) ||
    hash(archive.text) !== archive.contentHash ||
    !/General Election\s*-\s*11\/3\/2026/.test(archive.text)
  )
    throw new Error(
      "Historical contact proof archive is not the verified official election filing",
    );
  const reviewed = writeIn
    ? context.qualifications.some(
        (entry) =>
          entry.sourceContestId === membership.sourceContestId &&
          entry.proofs.some(
            (p) =>
              p.role === "historical_qualification" &&
              p.url === archive.url &&
              p.contentHash === archive.contentHash,
          ),
      )
    : context.rosterSourceHash === archive.contentHash;
  if (!reviewed)
    throw new Error(
      "Historical contact archive is absent from the reviewed roster or candidate qualification proof",
    );
  const record = officialRecord(
    archive.text,
    membership.sourceContestId,
    alias.sourceOrdinal,
  );
  if (writeIn && record.name !== member.name)
    throw new Error(
      "Historical write-in contact record belongs to a different candidate",
    );
  const fields = [...record.block.matchAll(/^Website:([^\n]*)$/gm)],
    field = fields[0];
  if (
    fields.length !== 1 ||
    !field ||
    /not\s+auth|do not release/i.test(field[1] ?? "")
  )
    throw new Error(
      "Official candidate record does not list a released Website field",
    );
  const listed = field[1]?.trim() ?? "",
    website = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(listed)
      ? listed
      : `https://${listed}`;
  if (
    canonicalCampaignContactUrl(website) !==
    canonicalCampaignContactUrl(proof.websiteUrl)
  )
    throw new Error(
      "Campaign URL does not equal this candidate's official Website field",
    );
  const lineStart = archive.text.slice(0, record.start).split("\n").length;
  const fieldLine =
    lineStart + record.block.slice(0, field.index).split("\n").length - 1;
  const expected = {
    url: archive.url,
    contentHash: archive.contentHash,
    fetchedAt: archive.fetchedAt,
    locator: `Archived official filing; county contest ${membership.sourceContestId}, source ordinal ${alias.sourceOrdinal}; extracted record lines ${lineStart}-${archive.text.slice(0, record.end).split("\n").length}; Website line ${fieldLine}`,
    excerpt: field[0],
    recordDigest: hash(record.block),
    officialRecordName: record.name,
  };
  if (
    Object.entries(expected).some(
      ([key, expectedValue]) =>
        proof.officialSource[key as keyof typeof expected] !== expectedValue,
    )
  )
    throw new Error(
      "Historical contact proof does not match the exact stored official candidate record",
    );
}
export async function verifyStoredCampaignContactProof(
  tx: ResearchTransaction,
  snapshotId: string | undefined,
  dossier: CandidateEvidenceDossier,
): Promise<void> {
  const proof = dossier.campaignContactProof;
  if (!proof) return;
  validateCampaignContactDestination(dossier);
  if (!snapshotId)
    throw new Error(
      "Historical contact proof requires a stored authoritative roster snapshot",
    );
  const [row] = await tx
    .select({
      electionDate: CaliforniaRoster.electionDate,
      kind: sql<unknown>`${CaliforniaRoster.document}->'localPrimary'->>'kind'`,
      memberships: sql<unknown>`(select coalesce(jsonb_agg(jsonb_build_object('sourceContestId',r->>'sourceContestId','officeFamily',r->>'officeFamily','member',m)),'[]'::jsonb) from jsonb_array_elements(${CaliforniaRoster.document}->'races') r cross join lateral jsonb_array_elements(r->'members') m where r->>'contestId'=${proof.identity.contestId} and r->>'jurisdiction'=${proof.identity.jurisdiction} and r->>'electionDate'=${proof.identity.electionDate} and m->>'candidateId'=${proof.identity.candidateId})`,
      aliases: sql<unknown>`${CaliforniaRoster.document}->'localPrimary'->'identityCrosswalk'->'members'`,
      archives: sql<unknown>`(select coalesce(jsonb_agg(s),'[]'::jsonb) from jsonb_array_elements(coalesce(${CaliforniaRoster.document}->'historicalSources','[]'::jsonb)) s where s->>'url'=${proof.officialSource.url} and s->>'contentHash'=${proof.officialSource.contentHash})`,
      rosterSourceHash: sql<unknown>`${CaliforniaRoster.document}->'localCrosswalk'->>'rosterSourceHash'`,
      membershipReview: sql<unknown>`${CaliforniaRoster.document}->'localPrimary'->'identityCrosswalk'->'review'`,
      scopeReview: sql<unknown>`${CaliforniaRoster.document}->'localCrosswalk'->'review'`,
      qualifications: sql<unknown>`${CaliforniaRoster.document}->'localCrosswalk'->'entries'`,
    })
    .from(CaliforniaRoster)
    .where(eq(CaliforniaRoster.id, snapshotId));
  if (row?.electionDate !== proof.identity.electionDate)
    throw new Error(
      "Historical contact proof snapshot is unavailable or belongs to another election",
    );
  validateStoredCampaignContactProof(proof, row);
}
