import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod/v4";

import type { Contest } from "./civic";
import { candidateTranslationId } from "./candidate-translation";
import { collectSegments, hashSegments } from "./content-translation";

const MAX_BYTES = 64_000;
const payloadSchema = z.object({
  expires: z.number().int(),
  identity: z.object({
    kind: z.enum(["measure", "contest"]),
    title: z.string().max(4000),
    candidates: z.array(z.string().max(500)).max(150),
  }),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  segments: z
    .array(z.object({ key: z.string().max(160), text: z.string().max(20_000) }))
    .max(150),
});
/** Verbatim statements, legal text, biographies and citations never enter this request. */
export function ballotSegments(contest: Contest) {
  const generated = (field: string) =>
    contest.citations?.some(
      (c) => c.field === field && c.tier === "ai_generated",
    );
  const fields = [
    "referendumTitle",
    "referendumSubtitle",
    "office",
    "ballotTitle",
    "roleDescription",
  ];
  for (const field of [
    "summary",
    "summaryShort",
    "summaryLong",
    "fiscalImpact",
  ])
    if (
      generated(field) ||
      (field.startsWith("summary") && contest.summaryIsAiGenerated)
    )
      fields.push(field);
  for (const field of ["proArguments", "conArguments"])
    if (generated(field)) fields.push(`${field}.*.text`);
  const candidateFields = new Set<string>();
  contest.candidates?.forEach((candidate, index) => {
    if (
      candidate.statementSummaryIsAiGenerated ||
      candidate.citations?.some(
        (c) => c.field === "statementSummary" && c.tier === "ai_generated",
      )
    )
      candidateFields.add(`ballot.candidates.${index}.statementSummary`);
  });
  return [
    ...collectSegments(contest, fields, "ballot"),
    ...collectSegments(
      contest,
      ["candidates.*.statementSummary"],
      "ballot",
    ).filter((segment) => candidateFields.has(segment.key)),
  ];
}
/** A short-lived server capability, containing no voter address or address hash. */
export function ballotTranslationReference(
  contest: Contest,
  secret: string,
  now = Date.now(),
) {
  const segments = ballotSegments(contest);
  if (!segments.length) return undefined;
  const payload = payloadSchema.safeParse({
    identity: {
      kind:
        contest.type.toLowerCase() === "referendum" || !!contest.referendumTitle
          ? "measure"
          : "contest",
      title:
        contest.referendumTitle ?? contest.office ?? contest.ballotTitle ?? "",
      candidates: contest.candidates?.map((candidate) => candidate.name) ?? [],
    },
    expires: now + 24 * 60 * 60 * 1000,
    sourceHash: hashSegments(segments),
    segments,
  });
  if (!payload.success) return undefined;
  const body = Buffer.from(JSON.stringify(payload.data)).toString("base64url");
  if (body.length > MAX_BYTES) return undefined;
  const signature = createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}
export function readBallotTranslationReference(
  reference: string,
  secret: string,
  now = Date.now(),
) {
  if (reference.length > MAX_BYTES + 100) return null;
  const [body, signature, extra] = reference.split(".");
  if (!body || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    const payload = payloadSchema.safeParse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
    );
    if (
      !payload.success ||
      payload.data.expires <= now ||
      payload.data.sourceHash !== hashSegments(payload.data.segments)
    )
      return null;
    return {
      ...payload.data,
      contentId: candidateTranslationId(`ballot:${payload.data.sourceHash}`),
    };
  } catch {
    return null;
  }
}
export function withBallotTranslationReferences<
  T extends { contests?: Contest[] },
>(ballot: T): T {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return ballot;
  return {
    ...ballot,
    contests: ballot.contests?.map((contest) => ({
      ...contest,
      translationReference: ballotTranslationReference(contest, secret),
    })),
  };
}
