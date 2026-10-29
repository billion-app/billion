import { z } from "zod";

export const CA_POLLING_ENDPOINT = "ca-election-polling-v1";
export const CA_POLLING_ADDRESS_HASH = "__global__";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");
const text = z.string().min(1);
const httpsUrl = z
  .string()
  .url()
  .refine(
    (value) =>
      new URL(value).protocol === "https:" &&
      new URL(value).hostname === "www.ppic.org" &&
      !new URL(value).username &&
      !new URL(value).password &&
      !new URL(value).port,
  );
export const pollingObservationSchema = z.object({
  questionId: text,
  locator: text,
  questionText: text,
  contest: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("candidate"),
      officeSlug: text,
      candidateNames: z.array(text).min(2),
    }),
    z.object({
      type: z.literal("measure"),
      number: z.string().regex(/^\d+$/),
      officialTitle: text,
    }),
  ]),
  population: z.literal("California statewide likely voters"),
  sampleSize: z.number().int().positive().nullable(),
  choices: z
    .array(
      z.object({
        kind: z.enum(["candidate", "yes", "no", "undecided", "other"]),
        label: text,
        candidateName: text.optional(),
        share: z.number().min(0).max(100),
      }),
    )
    .min(2),
});
export const californiaPollingReportSchema = z
  .object({
    electionDate: date,
    electionType: z.literal("general"),
    jurisdiction: z.literal("CA"),
    publisher: text,
    pollster: text,
    sponsor: text.nullable(),
    reportId: text,
    sourceUrl: httpsUrl,
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    retrievedAt: z.string().datetime(),
    publishedAt: date.nullable(),
    fieldStart: date,
    fieldEnd: date,
    sampleSize: z.number().int().positive().nullable(),
    marginOfError: z.number().positive().nullable(),
    marginOfErrorScope: text.nullable(),
    methodology: text.nullable(),
    sourceText: text,
    observations: z.array(pollingObservationSchema).min(1),
  })
  .superRefine((report, context) => {
    const retrieved = report.retrievedAt.slice(0, 10);
    if (
      report.fieldStart > report.fieldEnd ||
      report.fieldEnd > report.electionDate ||
      report.fieldEnd > retrieved ||
      (report.publishedAt !== null &&
        (report.fieldEnd > report.publishedAt ||
          report.publishedAt > retrieved))
    )
      context.addIssue({
        code: "custom",
        message: "Invalid polling chronology",
      });
    const questions = report.observations.map(
      (observation) => observation.questionId,
    );
    if (new Set(questions).size !== questions.length)
      context.addIssue({
        code: "custom",
        message: "Duplicate polling question",
      });
    for (const observation of report.observations) {
      if (
        report.sampleSize !== null &&
        observation.sampleSize !== null &&
        observation.sampleSize > report.sampleSize
      )
        context.addIssue({
          code: "custom",
          message: "Question sample exceeds survey sample",
        });
      const choices = observation.choices;
      const identities = choices.map(
        (choice) => `${choice.kind}:${choice.candidateName ?? choice.label}`,
      );
      const sum = choices.reduce((total, choice) => total + choice.share, 0);
      if (
        new Set(identities).size !== identities.length ||
        Math.abs(sum - 100) > choices.length * 0.5
      )
        context.addIssue({
          code: "custom",
          message: "Invalid polling response totals or identities",
        });
      if (observation.contest.type === "candidate") {
        const names = choices
          .filter((choice) => choice.kind === "candidate")
          .map((choice) => choice.candidateName);
        if (
          names.length !== observation.contest.candidateNames.length ||
          observation.contest.candidateNames.some(
            (name) => !names.includes(name),
          ) ||
          choices.some(
            (choice) => choice.kind === "yes" || choice.kind === "no",
          )
        )
          context.addIssue({
            code: "custom",
            message: "Polling candidate choices do not match roster",
          });
      } else if (
        choices.filter((choice) => choice.kind === "yes").length !== 1 ||
        choices.filter((choice) => choice.kind === "no").length !== 1 ||
        choices.some((choice) => choice.kind === "candidate")
      )
        context.addIssue({
          code: "custom",
          message: "Polling measure requires Yes and No choices",
        });
    }
  });
export type CaliforniaPollingReport = z.infer<
  typeof californiaPollingReportSchema
>;
export type PollingObservation = z.infer<typeof pollingObservationSchema>;
export type PublicPollingReport = Omit<
  CaliforniaPollingReport,
  "sourceText" | "observations"
>;
export interface ContestPoll {
  report: PublicPollingReport;
  observation: PollingObservation;
}
export function pollingCacheParams(
  report: Pick<
    CaliforniaPollingReport,
    "electionDate" | "electionType" | "publisher" | "reportId"
  >,
): string {
  return JSON.stringify({
    electionDate: report.electionDate,
    electionType: report.electionType,
    jurisdiction: "CA",
    publisher: report.publisher,
    reportId: report.reportId,
  });
}
export const pollingName = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function publicContestPoll(
  report: CaliforniaPollingReport,
  observation: PollingObservation,
): ContestPoll {
  const {
    sourceText: _sourceText,
    observations: _observations,
    ...metadata
  } = report;
  return { report: metadata, observation };
}
