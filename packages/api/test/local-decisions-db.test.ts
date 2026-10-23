import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq, inArray } from "@acme/db";
import {
  LocalBody,
  LocalDecision,
  LocalDecisionDocument,
  LocalJurisdiction,
  LocalMeeting,
  LocalMeetingItem,
} from "@acme/db/schema";
import { computeLocalDecisionSourceContext } from "@acme/validators/local-decision";

void test(
  "local decisions expose distinct durable matters and verified source briefs",
  { skip: !process.env.LOCAL_DECISIONS_TEST_DATABASE_URL },
  async (t) => {
    const databaseUrl = process.env.LOCAL_DECISIONS_TEST_DATABASE_URL;
    assert.ok(databaseUrl);
    const target = new URL(databaseUrl);
    assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
    assert.match(target.pathname, /_test$/);
    process.env.POSTGRES_URL = target.toString();
    const { db } = await import("@acme/db/client");
    const { appRouter } = await import("../src/root");
    const api = appRouter.createCaller({
      db,
      session: null,
      authApi: {} as never,
    });
    const keys = ["sanjose", "santaclara", "sunnyvale", "santaclara-county"];
    const existing = await db
      .select({ key: LocalJurisdiction.key })
      .from(LocalJurisdiction)
      .where(inArray(LocalJurisdiction.key, keys));
    assert.deepEqual(existing, [], "Use an empty dedicated fixture database");
    const now = new Date();
    const day = 86_400_000;
    const topic = randomUUID();
    const bodyId = randomUUID();
    const repeatedId = randomUUID();
    const otherId = randomUUID();
    const futureId = randomUUID();
    const deletedId = randomUUID();
    const documentId = randomUUID();
    const quote =
      "The council will consider funding repairs to the public library.";
    const sourceHash = "a".repeat(64);
    const meetings = [-1, -2, -3, 1].map((offset, index) => ({
      id: randomUUID(),
      jurisdictionKey: "sanjose",
      bodyId,
      sourceEventId: index + 1,
      startsAt: new Date(now.getTime() + offset * day),
      localDate: new Date(now.getTime() + offset * day)
        .toISOString()
        .slice(0, 10),
      sourceUrl: `https://sanjose.legistar.com/MeetingDetail.aspx?ID=${index + 1}`,
      sourceUpdatedAt: now,
    }));
    const [newest, older, oldest, future] = meetings;
    assert.ok(newest && older && oldest && future);
    const items = [
      { decisionId: repeatedId, meetingId: newest.id },
      { decisionId: repeatedId, meetingId: older.id },
      { decisionId: otherId, meetingId: oldest.id },
      { decisionId: futureId, meetingId: future.id },
      { decisionId: deletedId, meetingId: newest.id },
    ].map((item, index) => ({
      ...item,
      id: randomUUID(),
      sourceEventItemId: index + 1,
      sourceUpdatedAt: now,
      actionName: "Approved",
      actionText: "Approve library repairs",
      passedFlagName: "Pass",
      tally: "10-0",
    }));
    try {
      await db.insert(LocalJurisdiction).values(
        keys.map((key) => ({
          key,
          name: key,
          state: "CA",
          governmentLevel: key.endsWith("county") ? "county" : "city",
          timezone: "America/Los_Angeles",
          sourceType: "legistar",
          sourceClient: key,
          sourceBaseUrl: `https://webapi.legistar.com/v1/${key}`,
          publicPortalUrl: `https://${key}.legistar.com/Calendar.aspx`,
        })),
      );
      await db.insert(LocalBody).values({
        id: bodyId,
        jurisdictionKey: "sanjose",
        sourceBodyId: 1,
        name: "City Council",
        included: true,
      });
      await db.insert(LocalDecision).values([
        ...[repeatedId, otherId, futureId, deletedId].map((id, index) => ({
          id,
          jurisdictionKey: "sanjose",
          primaryBodyId: bodyId,
          sourceMatterId: index + 1,
          title: "Library repairs",
          topic,
          statusName: "Approved",
          sourceUpdatedAt: now,
          sourceDeletedAt: id === deletedId ? now : null,
          sourceUrl:
            "https://sanjose.legistar.com/LegislationDetail.aspx?ID=999999",
        })),
        ...keys.slice(1).map((key) => ({
          jurisdictionKey: key,
          sourceMatterId: 1,
          title: "Local decision fixture",
          sourceUpdatedAt: now,
        })),
      ]);
      await db.insert(LocalMeeting).values(meetings);
      await db.insert(LocalMeetingItem).values(items);
      await db.insert(LocalDecisionDocument).values({
        id: documentId,
        jurisdictionKey: "sanjose",
        decisionId: repeatedId,
        sourceAttachmentId: 1,
        name: "Staff report",
        url: "https://sanjose.legistar.com/View.ashx?M=F&ID=1",
        category: "staff_report",
        processingPolicy: "extract_text",
        extractionStatus: "native",
        extractedPages: [quote],
        contentHash: sourceHash,
        pageCount: 1,
      });

      await t.test(
        "deduplicates a matter before applying page offsets",
        async () => {
          const first = await api.legistar.listDecisions({
            jurisdiction: "sanjose",
            timeline: "recent",
            topic,
            limit: 1,
          });
          const second = await api.legistar.listDecisions({
            jurisdiction: "sanjose",
            timeline: "recent",
            topic,
            limit: 1,
            cursor: 1,
          });
          assert.deepEqual(
            first.map((item) => item.id),
            [repeatedId],
          );
          assert.equal(first[0]?.meetingId, newest.id);
          assert.deepEqual(
            second.map((item) => item.id),
            [otherId],
          );
        },
      );

      await t.test(
        "saved IDs include future decisions once and omit deleted records",
        async () => {
          const rows = await api.legistar.byIds({
            ids: [repeatedId, repeatedId, futureId, deletedId, randomUUID()],
          });
          assert.deepEqual(
            rows.map((row) => row.id).sort(),
            [repeatedId, futureId].sort(),
          );
          assert.deepEqual(await api.legistar.byIds({ ids: [] }), []);
          await assert.rejects(api.legistar.getDecision({ id: deletedId }), {
            code: "NOT_FOUND",
          });
        },
      );

      await t.test(
        "only offers supported active cities with browsable ingested decisions",
        async () => {
          assert.deepEqual(
            (await api.legistar.listJurisdictions()).map((row) => row.key),
            ["sanjose"],
            "Orphan matters without a live meeting occurrence do not enable a city",
          );
          for (const key of keys.slice(1)) {
            const [decision] = await db
              .select({ id: LocalDecision.id })
              .from(LocalDecision)
              .where(eq(LocalDecision.jurisdictionKey, key));
            assert.ok(decision);
            const localBodyId = randomUUID();
            const meetingId = randomUUID();
            await db
              .insert(LocalBody)
              .values({
                id: localBodyId,
                jurisdictionKey: key,
                sourceBodyId: 1,
                name: "Council",
                included: true,
              });
            await db.insert(LocalMeeting).values({
              id: meetingId,
              jurisdictionKey: key,
              bodyId: localBodyId,
              sourceEventId: 1,
              startsAt: now,
              localDate: now.toISOString().slice(0, 10),
              sourceUpdatedAt: now,
            });
            await db
              .insert(LocalMeetingItem)
              .values({
                meetingId,
                decisionId: decision.id,
                sourceEventItemId: 1,
                sourceUpdatedAt: now,
              });
          }
          assert.deepEqual(
            (await api.legistar.listJurisdictions())
              .map((row) => row.key)
              .sort(),
            ["sanjose", "santaclara"],
          );
          await db
            .update(LocalBody)
            .set({ included: false })
            .where(eq(LocalBody.jurisdictionKey, "santaclara"));
          assert.deepEqual(
            (await api.legistar.listJurisdictions()).map((row) => row.key),
            ["sanjose"],
          );
          await db
            .update(LocalBody)
            .set({ included: true })
            .where(eq(LocalBody.jurisdictionKey, "santaclara"));
          await db
            .update(LocalMeeting)
            .set({ sourceDeletedAt: now })
            .where(eq(LocalMeeting.jurisdictionKey, "santaclara"));
          assert.deepEqual(
            (await api.legistar.listJurisdictions()).map((row) => row.key),
            ["sanjose"],
          );
          await db
            .update(LocalMeeting)
            .set({ sourceDeletedAt: null })
            .where(eq(LocalMeeting.jurisdictionKey, "santaclara"));
          await db
            .update(LocalJurisdiction)
            .set({ active: false })
            .where(eq(LocalJurisdiction.key, "santaclara"));
          assert.deepEqual(
            (await api.legistar.listJurisdictions()).map((row) => row.key),
            ["sanjose"],
          );
          await db
            .update(LocalJurisdiction)
            .set({ active: true })
            .where(eq(LocalJurisdiction.key, "santaclara"));
          await db
            .update(LocalDecision)
            .set({ sourceDeletedAt: now })
            .where(eq(LocalDecision.jurisdictionKey, "santaclara"));
          assert.deepEqual(
            (await api.legistar.listJurisdictions()).map((row) => row.key),
            ["sanjose"],
          );
        },
      );

      await t.test(
        "uses the official meeting record instead of a fabricated matter URL",
        async () => {
          const detail = await api.legistar.getDecision({ id: repeatedId });
          assert.equal(detail.sourceUrl, newest.sourceUrl);
          assert.equal(detail.occurrences.length, 2);
        },
      );

      await t.test(
        "returns only current briefs backed by the cited source page",
        async () => {
          const sourceContext = computeLocalDecisionSourceContext({
            title: "Library repairs",
            status: "Approved",
            sourceUpdatedAt: now,
            occurrences: items
              .filter((item) => item.decisionId === repeatedId)
              .map((item) => {
                const meeting = meetings.find(
                  (candidate) => candidate.id === item.meetingId,
                );
                assert.ok(meeting);
                return {
                  id: item.id,
                  startsAt: meeting.startsAt,
                  action: item.actionName,
                  proposedAction: item.actionText,
                  passed: item.passedFlagName,
                  tally: item.tally,
                };
              }),
          });
          const brief = {
            version: 1,
            language: "en",
            generatedAt: now.toISOString(),
            sourceContext,
            sourceHashes: { [documentId]: sourceHash },
            claims: [
              {
                text: "The council is considering library repairs.",
                citations: [{ documentId, page: 1, quote }],
              },
            ],
          };
          await db
            .update(LocalDecision)
            .set({ brief })
            .where(eq(LocalDecision.id, repeatedId));
          assert.deepEqual(
            (await api.legistar.getDecision({ id: repeatedId })).brief,
            brief,
          );
          for (const invalid of [
            { claims: [] },
            { ...brief, sourceContext: "stale source context" },
            { ...brief, sourceHashes: { [documentId]: "b".repeat(64) } },
            {
              ...brief,
              claims: [
                {
                  text: "Unverified claim",
                  citations: [{ documentId, page: 2, quote }],
                },
              ],
            },
          ]) {
            await db
              .update(LocalDecision)
              .set({ brief: invalid })
              .where(eq(LocalDecision.id, repeatedId));
            assert.equal(
              (await api.legistar.getDecision({ id: repeatedId })).brief,
              null,
            );
            const [stored] = await db
              .select({ brief: LocalDecision.brief })
              .from(LocalDecision)
              .where(eq(LocalDecision.id, repeatedId));
            assert.deepEqual(
              stored?.brief,
              invalid,
              "Reading does not regenerate or overwrite a brief",
            );
          }
          await db
            .update(LocalDecision)
            .set({ brief })
            .where(eq(LocalDecision.id, repeatedId));
          const addedDocumentId = randomUUID();
          await db.insert(LocalDecisionDocument).values({
            id: addedDocumentId,
            jurisdictionKey: "sanjose",
            decisionId: repeatedId,
            sourceAttachmentId: 2,
            name: "Updated staff recommendation",
            url: "https://sanjose.legistar.com/View.ashx?M=F&ID=2",
            category: "staff_report",
            processingPolicy: "extract_text",
            extractionStatus: "native",
            extractedPages: ["Staff now recommends a revised repair schedule."],
            contentHash: "c".repeat(64),
            pageCount: 1,
          });
          assert.equal(
            (await api.legistar.getDecision({ id: repeatedId })).brief,
            null,
            "A newly ingested official source invalidates the earlier explanation",
          );
          await db
            .delete(LocalDecisionDocument)
            .where(eq(LocalDecisionDocument.id, addedDocumentId));
          assert.deepEqual(
            (await api.legistar.getDecision({ id: repeatedId })).brief,
            brief,
          );
          await db
            .update(LocalDecisionDocument)
            .set({ isPublicComment: true })
            .where(eq(LocalDecisionDocument.id, documentId));
          assert.equal(
            (await api.legistar.getDecision({ id: repeatedId })).brief,
            null,
          );
        },
      );
    } finally {
      await db
        .delete(LocalJurisdiction)
        .where(inArray(LocalJurisdiction.key, keys));
    }
  },
);
