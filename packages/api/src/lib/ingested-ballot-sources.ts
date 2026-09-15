import type { MeasureCitationRef, VoterInfoResponse } from "./civic";
import {
  CA_OFFICIAL_GUIDE_SOURCE,
  officialGuideOfficeSlug,
  officialGuidePayloadSchema,
} from "./official-guide-cache";
import { electionGuidanceSchema } from "./voting-logistics/ca-sos-cache";

const CA = "ocd-division/country:us/state:ca";
const nameKey = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const citation = (field: string, sourceUrl: string): MeasureCitationRef => ({
  field,
  sourceName: CA_OFFICIAL_GUIDE_SOURCE,
  sourceUrl,
  tier: "state_sos",
  official: true,
});

/** Add evidence only to contests already selected by the address-aware provider. */
export function attachIngestedBallotSources(
  ballot: VoterInfoResponse,
  guideValue: unknown,
  guidanceValue: unknown,
): VoterInfoResponse {
  const result = structuredClone(ballot);
  const date = result.election.electionDay;
  const division = result.election.ocdDivisionId;
  if (division !== CA && !division.startsWith(`${CA}/`)) return result;
  const guidance = electionGuidanceSchema.safeParse(guidanceValue);
  if (guidance.success && guidance.data.electionDate === date)
    result.officialVotingGuidance = guidance.data;

  const guide = officialGuidePayloadSchema.safeParse(guideValue);
  if (
    !guide.success ||
    !guide.data.complete ||
    guide.data.electionDate !== date
  )
    return result;
  for (const contest of result.contests ?? []) {
    // A county proposition may share a number with a statewide proposition.
    if (contest.district?.id !== CA) continue;
    const number = /^(?:California\s+)?(?:Proposition|Prop\.?)\s+(\d+[A-Z]?)\b/i
      .exec(contest.referendumTitle ?? "")?.[1]
      ?.toUpperCase();
    const measures = guide.data.measures.filter(
      (item) => item.number === number,
    );
    const measure = measures[0];
    if (measures.length === 1 && measure) {
      const updatedFields: string[] = [];
      if (measure.officialSummary) {
        contest.summary = measure.officialSummary;
        contest.summaryLong = measure.officialSummary;
        contest.summaryShort = undefined;
        contest.summaryIsAiGenerated = false;
        updatedFields.push("summary", "summaryLong");
      }
      if (measure.fiscalImpact) {
        contest.fiscalImpact = measure.fiscalImpact;
        updatedFields.push("fiscalImpact");
      }
      if (measure.proArguments?.length) {
        contest.proArguments = measure.proArguments;
        updatedFields.push("proArguments");
      }
      if (measure.conArguments?.length) {
        contest.conArguments = measure.conArguments;
        updatedFields.push("conArguments");
      }
      if (measure.fullTextUrl) {
        contest.referendumUrl = measure.fullTextUrl;
        updatedFields.push("referendumUrl");
      }
      contest.citations = [
        ...(contest.citations ?? []).filter(
          (item) =>
            !updatedFields.includes(item.field) &&
            !(measure.officialSummary && item.field === "summaryShort"),
        ),
        ...updatedFields.map((field) =>
          citation(
            field,
            field === "referendumUrl"
              ? (measure.fullTextUrl ?? measure.sourceUrl)
              : measure.sourceUrl,
          ),
        ),
      ];
    }
    const slug = officialGuideOfficeSlug(contest.office ?? "");
    if (!slug) continue;
    for (const candidate of contest.candidates ?? []) {
      const matches = guide.data.candidates.filter(
        (item) =>
          item.officeSlug === slug &&
          nameKey(item.name) === nameKey(candidate.name),
      );
      const statement = matches[0];
      if (matches.length !== 1 || !statement) continue;
      candidate.statement = statement.statement;
      candidate.statementSummary = undefined;
      candidate.statementSummaryIsAiGenerated = undefined;
      candidate.citations = [
        ...(candidate.citations ?? []).filter(
          (item) => !["statement", "statementSummary"].includes(item.field),
        ),
        citation("statement", statement.sourceUrl),
      ];
    }
  }
  return result;
}
