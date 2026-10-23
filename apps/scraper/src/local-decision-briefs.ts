import { parseArgs } from "node:util";

import { and, asc, eq, gt, isNull } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LocalDecision,
  LocalDecisionDocument,
  LocalMeeting,
  LocalMeetingItem,
} from "@acme/db/schema";
import {
  computeLocalDecisionSourceContext,
  validateLocalDecisionBrief,
} from "@acme/validators/local-decision";

import { generateLocalDecisionBrief } from "./scrapers/legistar-brief.js";
import { createLogger } from "./utils/log.js";

const logger = createLogger("Local decision briefs");
const { values } = parseArgs({
  options: {
    jurisdiction: { type: "string" },
    limit: { type: "string" },
    after: { type: "string" },
    write: { type: "boolean", default: false },
  },
});
const limit = Number(values.limit);
if (
  !["sanjose", "santaclara"].includes(values.jurisdiction ?? "") ||
  !Number.isInteger(limit) ||
  limit < 1 ||
  limit > 20 ||
  (values.after !== undefined &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      values.after,
    ))
) {
  throw new Error(
    "Provide --jurisdiction sanjose|santaclara and --limit 1..20. Add --write to authorize at most that many model calls.",
  );
}
const decisions = await db
  .select()
  .from(LocalDecision)
  .where(
    and(
      eq(LocalDecision.jurisdictionKey, values.jurisdiction!),
      isNull(LocalDecision.sourceDeletedAt),
      ...(values.after ? [gt(LocalDecision.id, values.after)] : []),
    ),
  )
  .orderBy(asc(LocalDecision.id))
  .limit(limit);
let attempted = 0;
let published = 0;
for (const decision of decisions) {
  const [documents, occurrences] = await Promise.all([
    db
      .select()
      .from(LocalDecisionDocument)
      .where(
        and(
          eq(LocalDecisionDocument.decisionId, decision.id),
          isNull(LocalDecisionDocument.sourceDeletedAt),
        ),
      ),
    db
      .select({
        id: LocalMeetingItem.id,
        startsAt: LocalMeeting.startsAt,
        action: LocalMeetingItem.actionName,
        proposedAction: LocalMeetingItem.actionText,
        passed: LocalMeetingItem.passedFlagName,
        tally: LocalMeetingItem.tally,
      })
      .from(LocalMeetingItem)
      .innerJoin(LocalMeeting, eq(LocalMeeting.id, LocalMeetingItem.meetingId))
      .where(
        and(
          eq(LocalMeetingItem.decisionId, decision.id),
          isNull(LocalMeetingItem.sourceDeletedAt),
          isNull(LocalMeeting.sourceDeletedAt),
        ),
      ),
  ]);
  const sourceContext = computeLocalDecisionSourceContext({
    title: decision.title,
    status: decision.statusName,
    sourceUpdatedAt: decision.sourceUpdatedAt,
    occurrences,
  });
  if (validateLocalDecisionBrief(decision.brief, documents, sourceContext))
    continue;
  if (!values.write) {
    logger.info(`Would prepare ${decision.id}`);
    continue;
  }
  attempted++;
  try {
    const result = await generateLocalDecisionBrief({
      title: decision.title,
      documents,
      sourceContext,
    });
    if (!result) continue;
    await db
      .update(LocalDecision)
      .set({ brief: result.brief })
      .where(
        and(
          eq(LocalDecision.id, decision.id),
          eq(LocalDecision.sourceUpdatedAt, decision.sourceUpdatedAt),
        ),
      );
    published++;
  } catch (error) {
    logger.error(`Failed to prepare ${decision.id}`, error);
  }
}
logger.info(
  `Examined ${decisions.length}; attempted ${attempted}; published ${published}`,
);
if (decisions.length === limit)
  logger.info(`Next page: --after ${decisions.at(-1)!.id}`);
process.exitCode = 0;
