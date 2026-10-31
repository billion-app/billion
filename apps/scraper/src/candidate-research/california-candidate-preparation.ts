import { z } from "zod/v4";

import type { CandidateEvidenceDossier } from "@acme/validators";
import {
  candidateBriefSchema,
  hasSubstantiveCandidateResearch,
} from "@acme/validators";

import type {
  CaliforniaAuthorCorrection,
  CaliforniaModelFailureDiagnostic,
} from "./california-ai.js";
import type {
  CaliforniaBounds,
  CaliforniaDependencies,
  CaliforniaWorkCheckpoint,
} from "./california.js";
import {
  californiaAuthorPromptVersion,
  californiaModelInput,
  CaliforniaModelInvocationError,
  californiaReviewerPromptVersion,
} from "./california-ai.js";
import {
  californiaResearchVersion,
  evidenceDigest,
} from "./california-dossier.js";
import { CaliforniaBudgetReached } from "./california-evidence.js";

type AuthorResult = Awaited<ReturnType<CaliforniaDependencies["author"]>>;
type ReviewResult = Awaited<ReturnType<CaliforniaDependencies["review"]>>;
type Lease = NonNullable<Awaited<ReturnType<CaliforniaDependencies["claim"]>>>;
type Provenance = NonNullable<
  CaliforniaWorkCheckpoint["candidateProvenance"]
>[string];
type PreparationDependencies = Pick<
  CaliforniaDependencies,
  | "now"
  | "artifact"
  | "saveArtifact"
  | "reserveDispatch"
  | "author"
  | "review"
  | "authorConfigurationKey"
  | "reviewerConfigurationKey"
  | "modelConfigurationKey"
>;
interface ModelUsage {
  modelCalls: number;
  inputTokenReservations: number;
  actualInputTokens: number | null;
  actualOutputTokens: number | null;
}
const correctionSchema = z.union([
  z.strictObject({
    kind: z.literal("author_validation"),
    previousOutput: z.unknown(),
    validationProblems: z.array(z.string().trim().min(1)).min(1),
  }),
  z.strictObject({
    kind: z.literal("review_rejection"),
    previousBrief: candidateBriefSchema,
    overallReason: z.string().nullable(),
    findings: z.array(
      z.strictObject({
        claimId: z.string(),
        supported: z.boolean(),
        reason: z.string(),
      }),
    ),
  }),
]);
const planSchema = z.strictObject({
  version: z.literal(1),
  rootAuthorKey: z.string(),
  ordinal: z.literal(1),
  authorPromptVersion: z.string(),
  authorConfiguration: z.string(),
  feedbackDigest: z.string(),
  feedback: correctionSchema,
  triggerArtifactKey: z.string(),
  authorKey: z.string(),
});
type CorrectionPlan = z.infer<typeof planSchema>;
type AttemptOutcome =
  | { kind: "approved"; authored: AuthorResult; reviewed: ReviewResult }
  | {
      kind: "correction";
      feedback: CaliforniaAuthorCorrection;
      triggerArtifactKey: string;
    };

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  return value;
}
const feedbackHash = (value: CaliforniaAuthorCorrection) =>
  evidenceDigest(canonicalValue(value));

export class PendingCandidateResearchGap extends Error {}

function actionableReason(reason: string | null | undefined) {
  const text = reason?.trim();
  return (
    !!text &&
    !/^(?:reject(?:ed|ion)?|not approved|unsupported|review failed|the brief (?:is |was )?rejected|independent candidate content review rejected this exact revision)[.!\s]*$/i.test(
      text,
    )
  );
}

function validationFeedback(value: unknown): CaliforniaAuthorCorrection | null {
  if (!value || typeof value !== "object") return null;
  const diagnostic = value as Partial<CaliforniaModelFailureDiagnostic>;
  if (
    diagnostic.role !== "author" ||
    diagnostic.errorKind !== "schema_validation" ||
    typeof diagnostic.configuredModel !== "string" ||
    !diagnostic.configuredModel.trim() ||
    typeof diagnostic.actualModel !== "string" ||
    !diagnostic.actualModel.trim() ||
    typeof diagnostic.provider !== "string" ||
    !diagnostic.provider.trim() ||
    !Number.isFinite(Date.parse(diagnostic.startedAt ?? "")) ||
    !Number.isFinite(Date.parse(diagnostic.completedAt ?? "")) ||
    !Array.isArray(diagnostic.validationProblems) ||
    !diagnostic.validationProblems.length ||
    !diagnostic.validationProblems.every(
      (problem) => typeof problem === "string" && problem.trim(),
    )
  )
    return null;
  const returnedOutputWithoutFinish =
    diagnostic.finishReason === null &&
    diagnostic.parsedOutput !== null &&
    diagnostic.parsedOutput !== undefined &&
    typeof diagnostic.requestId === "string" &&
    !!diagnostic.requestId.trim() &&
    typeof diagnostic.usage?.inputTokens === "number" &&
    Number.isFinite(diagnostic.usage.inputTokens) &&
    diagnostic.usage.inputTokens >= 0 &&
    typeof diagnostic.usage.outputTokens === "number" &&
    Number.isFinite(diagnostic.usage.outputTokens) &&
    diagnostic.usage.outputTokens >= 0;
  if (diagnostic.finishReason !== "stop" && !returnedOutputWithoutFinish)
    return null;
  let previousOutput = diagnostic.parsedOutput;
  if (previousOutput === null || previousOutput === undefined) {
    if (typeof diagnostic.rawText !== "string" || !diagnostic.rawText.trim())
      return null;
    try {
      previousOutput = JSON.parse(diagnostic.rawText);
    } catch {
      return null;
    }
  }
  return {
    kind: "author_validation",
    previousOutput,
    validationProblems: diagnostic.validationProblems,
  };
}

export async function prepareReviewedCaliforniaCandidate(
  input: {
    dossier: CandidateEvidenceDossier;
    policyVersion: string;
    lease: Lease;
    raceKey: string;
    candidateId: string;
    bounds: Pick<CaliforniaBounds, "maxModelCalls" | "maxInputTokens">;
    usage: ModelUsage;
    provenance: Provenance;
  },
  deps: PreparationDependencies,
) {
  const { dossier, policyVersion, lease, usage, provenance } = input;
  const configuration =
    deps.authorConfigurationKey ?? deps.modelConfigurationKey ?? "fixture";
  const rootAuthorKey = `author:${evidenceDigest([dossier.dossierDigest, policyVersion, californiaResearchVersion, californiaAuthorPromptVersion, configuration])}`;
  const slotKey = `correction-plan:${rootAuthorKey}:1`;
  const artifactKeys = (provenance.modelArtifactKeys ??= []);
  const remember = (key: string) => {
    if (!artifactKeys.includes(key)) artifactKeys.push(key);
  };
  const save = (key: string, kind: string, document: unknown) =>
    deps.saveArtifact({
      key,
      kind,
      document,
      raceKey: input.raceKey,
      candidateId: input.candidateId,
    });
  function account(tokens: {
    inputTokens: number | null;
    outputTokens: number | null;
  }) {
    usage.actualInputTokens =
      usage.actualInputTokens === null || tokens.inputTokens === null
        ? null
        : usage.actualInputTokens + tokens.inputTokens;
    usage.actualOutputTokens =
      usage.actualOutputTokens === null || tokens.outputTokens === null
        ? null
        : usage.actualOutputTokens + tokens.outputTokens;
  }
  async function invoke<T extends AuthorResult | ReviewResult>(
    key: string,
    kind: "author" | "review",
    modelInput: Parameters<typeof californiaModelInput>[0],
    call: () => Promise<T>,
    rejectedCorrectionKey?: string,
  ): Promise<T> {
    let inputTokenReservation: number;
    try {
      inputTokenReservation =
        californiaModelInput(modelInput).inputTokenReservation;
    } catch (error) {
      if (modelInput.correction)
        throw new PendingCandidateResearchGap(
          "The bounded correction prompt exceeds the complete model input limit.",
        );
      throw error;
    }
    if (
      usage.modelCalls >= input.bounds.maxModelCalls ||
      usage.inputTokenReservations + inputTokenReservation >
        input.bounds.maxInputTokens
    )
      throw new CaliforniaBudgetReached("model calls or input tokens");
    const reserved = await deps.reserveDispatch({
      key: `dispatch:${key}`,
      raceKey: input.raceKey,
      candidateId: input.candidateId,
      document: { startedAt: deps.now(), costUsd: null },
      workLease: lease,
    });
    if (!reserved)
      throw new Error(
        "Model dispatch is already reserved or its race lease expired; no invocation was made",
      );
    usage.modelCalls++;
    usage.inputTokenReservations += inputTokenReservation;
    let result: T;
    try {
      result = await call();
    } catch (error) {
      if (error instanceof CaliforniaModelInvocationError) {
        account(error.diagnostic.usage);
        remember(`failure:${key}`);
        await save(`failure:${key}`, "model_failure", error.diagnostic);
      } else {
        account({ inputTokens: null, outputTokens: null });
      }
      throw error;
    }
    account(result.attestation.usage);
    if (
      rejectedCorrectionKey &&
      "verdict" in result &&
      result.verdict === "reject"
    ) {
      remember(rejectedCorrectionKey);
      await save(rejectedCorrectionKey, "model_correction_rejection", {
        reviewKey: key,
        reviewed: result,
      });
    }
    return (await save(key, kind, result)) as T;
  }
  async function attempt(
    authorKey: string,
    correction?: CaliforniaAuthorCorrection,
  ): Promise<AttemptOutcome> {
    remember(authorKey);
    let authored = (await deps.artifact(authorKey)) as AuthorResult | null;
    const rejected = correction
      ? ((await deps.artifact(`correction-rejected:${authorKey}`)) as {
          reviewKey: string;
          reviewed: ReviewResult;
        } | null)
      : null;
    if (rejected) {
      remember(`correction-rejected:${authorKey}`);
      remember(rejected.reviewKey);
      if (authored)
        Object.assign(provenance, {
          revisionId: authored.brief.revisionId,
          author: authored.attestation,
        });
      Object.assign(provenance, {
        reviewer: rejected.reviewed.attestation,
        verdict: rejected.reviewed.verdict,
      });
      throw new Error(
        "Independent review rejected the bounded candidate correction",
      );
    }
    if (!authored) {
      const failure = await deps.artifact(`failure:${authorKey}`);
      if (failure) {
        remember(`failure:${authorKey}`);
        const feedback = validationFeedback(failure);
        if (feedback && !correction)
          return {
            kind: "correction",
            feedback,
            triggerArtifactKey: `failure:${authorKey}`,
          };
        throw new Error(
          "Saved author failure cannot be retried; bounded correction is exhausted or unavailable",
        );
      }
      try {
        authored = await invoke(
          authorKey,
          "author",
          { dossier, policyVersion, correction },
          () => deps.author({ dossier, policyVersion, correction }),
        );
      } catch (error) {
        const feedback =
          error instanceof CaliforniaModelInvocationError
            ? validationFeedback(error.diagnostic)
            : null;
        if (feedback && !correction)
          return {
            kind: "correction",
            feedback,
            triggerArtifactKey: `failure:${authorKey}`,
          };
        throw error;
      }
    }
    Object.assign(provenance, {
      revisionId: authored.brief.revisionId,
      author: authored.attestation,
    });
    if (
      provenance.reviewer?.revisionDigest !==
      authored.attestation.revisionDigest
    ) {
      delete provenance.reviewer;
      delete provenance.verdict;
    }
    const substantive = hasSubstantiveCandidateResearch(
      authored.brief,
      dossier,
    );
    const candidateEvidenceIds = dossier.evidence
      .filter((entry) =>
        [
          "candidate_statement",
          "candidate_record",
          "campaign_material",
        ].includes(entry.role),
      )
      .map((entry) => entry.id);
    const hasCandidateProse = authored.brief.sections.some(
      (section) =>
        ["priorities", "record"].includes(section.topic) &&
        section.claims.length > 0,
    );
    if (
      !correction &&
      candidateEvidenceIds.length &&
      (!substantive || !hasCandidateProse)
    )
      return {
        kind: "correction",
        triggerArtifactKey: authorKey,
        feedback: {
          kind: "author_validation",
          previousOutput: authored.brief,
          validationProblems: [
            `Reassess the supplied candidate evidence IDs ${JSON.stringify(candidateEvidenceIds)} against their full context before settling on a finance-only or otherwise non-substantive brief. Valid financial research does not decide whether these passages support candidate priorities or record research. Explicit named-subject campaign accounts may support clearly campaign-attributed priorities or record claims. Unresolved speakers, third-party pledges, ambiguous referents, and mere hosting never establish candidate adoption. Do not infer personal authorship or independent verification. Return honest empty claims when the evidence cannot support research; do not invent content to satisfy this reassessment. Preserve valid financial research when the context cannot establish candidate prose.`,
          ],
        },
      };
    if (!substantive) {
      throw new PendingCandidateResearchGap(
        "The authored brief does not yet present a publishable account of this candidate's priorities, record, or campaign finances.",
      );
    }
    const reviewKey = `review:${evidenceDigest([authored.attestation.revisionDigest, dossier.dossierDigest, policyVersion, californiaReviewerPromptVersion, deps.reviewerConfigurationKey ?? deps.modelConfigurationKey ?? "fixture", lease.key, lease.reviewEpoch])}`;
    remember(reviewKey);
    let reviewed = (await deps.artifact(reviewKey)) as ReviewResult | null;
    if (!reviewed) {
      if (await deps.artifact(`failure:${reviewKey}`)) {
        remember(`failure:${reviewKey}`);
        throw new Error("Saved reviewer failure cannot be retried");
      }
      const revision = authored;
      reviewed = await invoke(
        reviewKey,
        "review",
        { dossier, policyVersion, brief: revision.brief },
        () =>
          deps.review({
            brief: revision.brief,
            dossier,
            policyVersion,
            authorAttestation: revision.attestation,
          }),
        correction ? `correction-rejected:${authorKey}` : undefined,
      );
    }
    Object.assign(provenance, {
      reviewer: reviewed.attestation,
      verdict: reviewed.verdict,
    });
    if (reviewed.verdict === "approve")
      return { kind: "approved", authored, reviewed };
    if (
      !correction &&
      (actionableReason(reviewed.overallReason) ||
        reviewed.findings.some(
          (finding) => !finding.supported && actionableReason(finding.reason),
        ))
    )
      return {
        kind: "correction",
        triggerArtifactKey: reviewKey,
        feedback: {
          kind: "review_rejection",
          previousBrief: authored.brief,
          overallReason: reviewed.overallReason ?? null,
          findings: reviewed.findings,
        },
      };
    throw new Error(
      "Independent candidate content review rejected this exact revision; bounded correction is exhausted or unavailable",
    );
  }
  const childKey = (feedbackDigest: string) =>
    `author-correction:${evidenceDigest([rootAuthorKey, 1, feedbackDigest, californiaAuthorPromptVersion, configuration])}`;
  function parsePlan(value: unknown): CorrectionPlan {
    const plan = planSchema.parse(value);
    if (
      plan.rootAuthorKey !== rootAuthorKey ||
      plan.authorPromptVersion !== californiaAuthorPromptVersion ||
      plan.authorConfiguration !== configuration ||
      plan.feedbackDigest !== feedbackHash(plan.feedback) ||
      plan.authorKey !== childKey(plan.feedbackDigest) ||
      (plan.feedback.kind === "author_validation"
        ? plan.triggerArtifactKey !== `failure:${rootAuthorKey}` &&
          plan.triggerArtifactKey !== rootAuthorKey
        : !plan.triggerArtifactKey.startsWith("review:"))
    )
      throw new Error(
        "Stored candidate correction plan does not match its immutable author contract",
      );
    return plan;
  }
  const stored = await deps.artifact(slotKey);
  let plan: CorrectionPlan;
  if (stored) plan = parsePlan(stored);
  else {
    const outcome = await attempt(rootAuthorKey);
    if (outcome.kind === "approved")
      return {
        dossier,
        authored: outcome.authored,
        reviewed: outcome.reviewed,
      };
    const feedback = correctionSchema.parse(outcome.feedback);
    const feedbackDigest = feedbackHash(feedback);
    plan = parsePlan(
      await save(slotKey, "model_correction", {
        version: 1,
        rootAuthorKey,
        ordinal: 1,
        authorPromptVersion: californiaAuthorPromptVersion,
        authorConfiguration: configuration,
        feedbackDigest,
        feedback,
        triggerArtifactKey: outcome.triggerArtifactKey,
        authorKey: childKey(feedbackDigest),
      }),
    );
  }
  remember(rootAuthorKey);
  remember(slotKey);
  remember(plan.triggerArtifactKey);
  const corrected = await attempt(plan.authorKey, plan.feedback);
  if (corrected.kind !== "approved")
    throw new Error("Candidate correction exhausted");
  return {
    dossier,
    authored: corrected.authored,
    reviewed: corrected.reviewed,
  };
}
