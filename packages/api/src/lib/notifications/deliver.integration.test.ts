import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";

import { eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  DeviceFollow,
  GovernmentContent,
  LocalBody,
  LocalDecision,
  LocalJurisdiction,
  LocalMeeting,
  LocalMeetingItem,
  NotificationOutbox,
  PushDevice,
} from "@acme/db/schema";

import type { ExpoPushMessage, ExpoPushTicket } from "./expo-push";
import { notificationsRouter } from "../../router/notifications";
import { createTRPCRouter } from "../../trpc";
import {
  checkPushReceipts,
  drainOutbox,
  drainTestAlert,
  enqueueExecutiveOrders,
  enqueueFollowMoves,
  enqueueLocalDecisionMoves,
  enqueueNewBills,
  enqueueTestAlert,
  runFollowNotifications,
} from "./deliver";

// Run only against an explicitly selected, migrated, disposable local database.
const databaseUrl = process.env.NOTIFICATIONS_TEST_DATABASE_URL;
void test(
  "notification delivery and API regressions",
  { skip: !databaseUrl, timeout: 30_000 },
  async (t) => {
    assert.ok(databaseUrl);
    const target = new URL(databaseUrl);
    assert.ok(["127.0.0.1", "localhost"].includes(target.hostname));
    assert.ok(target.pathname.endsWith("_test"));
    target.searchParams.set("options", "-c timezone=America/Los_Angeles");
    process.env.POSTGRES_URL = target.toString();
    assert.equal(
      (await db.select().from(PushDevice)).length,
      0,
      "Use an empty test database",
    );
    const messages: ExpoPushMessage[] = [];
    let reject = false;
    let rejectError = "DeviceNotRegistered";
    let beforeSend: (() => Promise<void>) | undefined;
    let receiptHttpError = false;
    let receiptRequests = 0;
    const receipts: Record<string, ExpoPushTicket> = {};
    t.mock.method(globalThis, "fetch", (url: string, init: RequestInit) => {
      if (url === "https://exp.host/--/api/v2/push/getReceipts") {
        receiptRequests++;
        const { ids } = JSON.parse(init.body as string) as { ids: string[] };
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: Object.fromEntries(
                ids
                  .filter((id) => receipts[id])
                  .map((id) => [id, receipts[id]]),
              ),
            }),
            { status: receiptHttpError ? 503 : 200 },
          ),
        );
      }
      assert.equal(url, "https://exp.host/--/api/v2/push/send");
      assert.equal(typeof init.body, "string");
      const batch = JSON.parse(init.body as string) as ExpoPushMessage[];
      messages.push(...batch);
      return Promise.resolve(beforeSend?.()).then(
        () =>
          new Response(
            JSON.stringify({
              data: batch.map(() =>
                reject
                  ? {
                      status: "error",
                      message: "Device not registered",
                      details: { error: rejectError },
                    }
                  : { status: "ok", id: randomUUID() },
              ),
            }),
          ),
      );
    });
    const billId = randomUUID();
    const deviceIds: string[] = [];
    const orderIds: string[] = [];
    const caller = createTRPCRouter(notificationsRouter).createCaller({
      session: null,
      db,
      authApi: {} as never,
    });
    const prefs = {
      following: true,
      breaking: false,
      brief: false,
      recap: false,
      quietHours: false,
      quietStartMin: 1320,
      quietEndMin: 420,
    };
    const token = `ExpoPushToken[${randomUUID()}]`;
    const sync = async (following = true, followIds = [billId]) =>
      caller.sync({
        token,
        platform: "ios",
        timezone: "UTC",
        prefs: { ...prefs, following },
        followIds,
      });
    try {
      await db.insert(Bill).values({
        id: billId,
        billNumber: "TEST 1",
        title: "Synthetic notification test",
        url: `https://example.com/${billId}`,
        sourceWebsite: "test",
        lastActionAt: new Date("2026-01-01"),
      });
      const { deviceId } = await sync();
      deviceIds.push(deviceId);
      const queue = async (notBefore = new Date(0), id = deviceId) => {
        await db.insert(NotificationOutbox).values({
          deviceId: id,
          contentId: billId,
          kind: "follow",
          title: "Queued follow",
          body: "Changed",
          href: `/article-detail?id=${billId}`,
          notBefore,
        });
      };
      await t.test(
        "local follows baseline archive, deduplicate real changes, and honor cancellation",
        async () => {
          const jurisdiction = `test-${randomUUID()}`;
          const localToken = `ExpoPushToken[${randomUUID()}]`;
          const decisionId = randomUUID();
          const bodyId = randomUUID();
          const meetingId = randomUUID();
          const itemId = randomUUID();
          const now = new Date("2026-10-22T23:00:00Z");
          const syncLocal = (
            following = true,
            ids = [decisionId],
            quietHours = true,
          ) =>
            caller.sync({
              token: localToken,
              platform: "ios",
              timezone: "UTC",
              prefs: { ...prefs, following, quietHours },
              followIds: ids,
            });
          let localDevice: string | undefined;
          try {
            await db.insert(LocalJurisdiction).values({
              key: jurisdiction,
              name: "Test City",
              state: "CA",
              governmentLevel: "city",
              timezone: "UTC",
              sourceType: "test",
              sourceClient: "test",
              sourceBaseUrl: "https://example.com",
            });
            await db.insert(LocalBody).values({
              id: bodyId,
              jurisdictionKey: jurisdiction,
              sourceBodyId: 1,
              name: "Council",
            });
            await db.insert(LocalDecision).values({
              id: decisionId,
              jurisdictionKey: jurisdiction,
              sourceMatterId: 1,
              title: "Local follow fixture",
              sourceUpdatedAt: now,
            });
            await db.insert(LocalMeeting).values({
              id: meetingId,
              bodyId,
              jurisdictionKey: jurisdiction,
              sourceEventId: 1,
              startsAt: new Date("2026-10-23T12:00:00Z"),
              localDate: "2026-10-23",
              sourceUpdatedAt: now,
            });
            await db.insert(LocalMeetingItem).values({
              id: itemId,
              meetingId,
              decisionId,
              sourceEventItemId: 1,
              sourceUpdatedAt: now,
              actionName: "Introduced",
            });
            const registered = await syncLocal();
            localDevice = registered.deviceId;
            const outbox = () =>
              db
                .select()
                .from(NotificationOutbox)
                .where(eq(NotificationOutbox.deviceId, registered.deviceId));
            const follow = async () =>
              (
                await db
                  .select()
                  .from(DeviceFollow)
                  .where(eq(DeviceFollow.deviceId, registered.deviceId))
              )[0];
            const baseline = (await follow())?.localDecisionState;
            assert.equal((await follow())?.contentType, "local_decision");
            assert.ok(baseline?.length);
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            await db
              .update(LocalDecision)
              .set({ title: "Retitled", sourceUpdatedAt: new Date() })
              .where(eq(LocalDecision.id, decisionId));
            await db
              .update(LocalMeetingItem)
              .set({
                title: "Retitled item",
                actionText: "Editorial text",
                sourceUpdatedAt: new Date(),
              })
              .where(eq(LocalMeetingItem.id, itemId));
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            await syncLocal();
            assert.deepEqual((await follow())?.localDecisionState, baseline);
            await db
              .update(LocalMeeting)
              .set({ startsAt: new Date("2026-10-24T12:00:00Z") })
              .where(eq(LocalMeeting.id, meetingId));
            const runs = await Promise.all([
              enqueueLocalDecisionMoves(now),
              enqueueLocalDecisionMoves(now),
            ]);
            assert.equal(
              runs.reduce((sum, run) => sum + run.enqueued, 0),
              1,
            );
            await syncLocal();
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            const queued = (await outbox())[0];
            assert.equal(queued?.kind, "follow");
            assert.equal(
              queued.href,
              `/local-decision-detail?id=${decisionId}`,
            );
            assert.equal(
              queued.notBefore.toISOString(),
              "2026-10-23T07:00:00.000Z",
            );
            assert.equal((await drainOutbox(now)).sent, 0);
            const drains = await Promise.all([
              drainOutbox(new Date("2026-10-23T07:00:00Z")),
              drainOutbox(new Date("2026-10-23T07:00:00Z")),
            ]);
            assert.equal(
              drains.reduce((sum, run) => sum + run.sent, 0),
              1,
            );
            assert.equal(
              messages.at(-1)?.data.href,
              `/local-decision-detail?id=${decisionId}`,
            );
            assert.equal(
              (await caller.history({ token: localToken })).length,
              1,
            );
            await db
              .update(LocalMeeting)
              .set({ startsAt: new Date("2026-10-25T12:00:00Z") })
              .where(eq(LocalMeeting.id, meetingId));
            await Promise.all([
              enqueueLocalDecisionMoves(now),
              syncLocal(true, []),
            ]);
            assert.equal(
              (await outbox()).filter((row) => !row.sentAt).length,
              0,
            );
            await syncLocal();
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            await db
              .update(LocalMeetingItem)
              .set({ actionName: "Approved", tally: "7-0" })
              .where(eq(LocalMeetingItem.id, itemId));
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 1);
            await syncLocal(false);
            await syncLocal(true);
            assert.equal((await outbox()).length, 1);
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            await db
              .update(LocalMeeting)
              .set({ cancelled: true })
              .where(eq(LocalMeeting.id, meetingId));
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 1);
            await syncLocal(true, []);
            await syncLocal();
            assert.equal((await outbox()).length, 1);
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            await db
              .update(DeviceFollow)
              .set({ createdAt: new Date("2026-10-21T23:00:00Z") })
              .where(eq(DeviceFollow.deviceId, registered.deviceId));
            for (const [sourceEventId, startsAt] of [
              [2, "2026-10-22T12:00:00Z"],
              [3, "2026-10-20T12:00:00Z"],
            ] as const) {
              const lateMeeting = randomUUID();
              await db.insert(LocalMeeting).values({
                id: lateMeeting,
                bodyId,
                jurisdictionKey: jurisdiction,
                sourceEventId,
                startsAt: new Date(startsAt),
                localDate: startsAt.slice(0, 10),
                sourceUpdatedAt: now,
              });
              await db.insert(LocalMeetingItem).values({
                meetingId: lateMeeting,
                decisionId,
                sourceEventItemId: sourceEventId,
                actionName: "Approved",
                sourceUpdatedAt: now,
              });
              assert.equal(
                (await enqueueLocalDecisionMoves(now)).enqueued,
                sourceEventId === 2 ? 1 : 0,
              );
            }
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            await syncLocal(false);
            await syncLocal();
            await db
              .update(DeviceFollow)
              .set({ localDecisionState: null })
              .where(eq(DeviceFollow.deviceId, registered.deviceId));
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            assert.ok((await follow())?.localDecisionState?.length);
            await db
              .update(LocalMeetingItem)
              .set({ sourceDeletedAt: now, tally: "8-0" })
              .where(eq(LocalMeetingItem.id, itemId));
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            await db
              .update(LocalMeetingItem)
              .set({ sourceDeletedAt: null, tally: "8-0" })
              .where(eq(LocalMeetingItem.id, itemId));
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 1);
            await db
              .update(LocalDecision)
              .set({ sourceDeletedAt: now })
              .where(eq(LocalDecision.id, decisionId));
            assert.equal((await enqueueLocalDecisionMoves(now)).enqueued, 0);
            assert.equal(
              (await drainOutbox(new Date("2026-10-23T07:00:00Z"))).sent,
              0,
            );
            await syncLocal(true, []);
            await syncLocal();
            assert.equal(await follow(), undefined);
          } finally {
            if (localDevice)
              await db.delete(PushDevice).where(eq(PushDevice.id, localDevice));
            await db
              .delete(LocalJurisdiction)
              .where(eq(LocalJurisdiction.key, jurisdiction));
          }
        },
      );
      await t.test(
        "new Congress bills reach opted-in phones once, including delayed ingestion and workers",
        async () => {
          const newToken = `ExpoPushToken[${randomUUID()}]`;
          const billIds: string[] = [];
          const billSync = (newBills?: boolean, quietHours = false) =>
            caller.sync({
              token: newToken,
              platform: "ios",
              timezone: "UTC",
              prefs: { ...prefs, following: false, newBills, quietHours },
              followIds: [],
            });
          const { deviceId: newDevice } = await billSync();
          deviceIds.push(newDevice);
          const device = async () => {
            const [row] = await db
              .select()
              .from(PushDevice)
              .where(eq(PushDevice.id, newDevice));
            assert.ok(row);
            return row;
          };
          const outbox = () =>
            db
              .select()
              .from(NotificationOutbox)
              .where(eq(NotificationOutbox.deviceId, newDevice));
          try {
            assert.equal((await device()).newBillsSubscribedAt, null);
            await billSync(true);
            const originalStart = (await device()).newBillsSubscribedAt;
            assert.ok(originalStart);
            await billSync(true);
            await billSync();
            assert.equal(
              (await device()).newBillsSubscribedAt?.getTime(),
              originalStart.getTime(),
            );

            const day = new Date();
            day.setUTCHours(0, 0, 0, 0);
            const ingestionDay = new Date(day.getTime() - 10 * 86400_000);
            const ingestedAt = new Date(
              ingestionDay.getTime() + (3 * 3600 + 17 * 60 + 44) * 1000,
            );
            const introducedAt = new Date(
              ingestionDay.getTime() - 3 * 86400_000,
            );
            const subscription = new Date(ingestionDay.getTime() - 86400_000);
            await db
              .update(PushDevice)
              .set({ newBillsSubscribedAt: subscription })
              .where(eq(PushDevice.id, newDevice));
            const insertBill = async (
              overrides: Partial<typeof Bill.$inferInsert> = {},
            ) => {
              const id = randomUUID();
              billIds.push(id);
              await db.insert(Bill).values({
                id,
                billNumber: `TEST ${id}`,
                title: "Recently introduced bill",
                url: `https://example.com/${id}`,
                sourceWebsite: "congress.gov",
                createdAt: ingestedAt,
                introducedDate: introducedAt,
                ...overrides,
              });
              return id;
            };
            const missed = await insertBill({
              billNumber: "S. 5686",
              title: "No Public Executions in America Act",
            });
            await insertBill({
              createdAt: new Date(subscription.getTime() - 1),
            });
            await insertBill({
              introducedDate: new Date(
                ingestionDay.getTime() - 7 * 86400_000 - 1,
              ),
            });
            await insertBill({ sourceWebsite: "openstates.org" });
            await insertBill({ introducedDate: null });
            await insertBill({
              introducedDate: new Date(ingestedAt.getTime() + 1),
            });
            const futureId = await insertBill({
              createdAt: new Date(day.getTime() + 2 * 86400_000),
            });
            await db
              .update(PushDevice)
              .set({ disabledAt: new Date() })
              .where(eq(PushDevice.id, newDevice));
            assert.equal((await enqueueNewBills()).enqueued, 0);
            await billSync(true);
            const result = await runFollowNotifications();
            assert.equal(result.enqueued, 1);
            assert.equal(result.sent, 1);
            const history = await caller.history({ token: newToken });
            assert.equal(history.length, 1);
            assert.equal(history[0]?.kind, "new_bill");
            assert.equal(history[0].title, "New bill in Congress");
            assert.equal(
              history[0].body,
              "S. 5686: No Public Executions in America Act",
            );
            assert.equal(history[0].href, `/article-detail?id=${missed}`);
            assert.equal(messages.at(-1)?.data.kind, "new_bill");
            assert.equal(
              messages.at(-1)?.data.href,
              `/article-detail?id=${missed}`,
            );
            assert.equal((await runFollowNotifications()).sent, 0);
            await db
              .update(Bill)
              .set({ title: "Updated source title", lastActionAt: new Date() })
              .where(eq(Bill.id, missed));
            assert.equal((await enqueueNewBills()).enqueued, 0);

            const boundary = await insertBill({
              introducedDate: new Date(ingestionDay.getTime() - 7 * 86400_000),
            });
            await billSync(true, true);
            const quiet = new Date(day.getTime() + 23 * 3600_000);
            const runs = await Promise.all([
              enqueueNewBills(quiet),
              enqueueNewBills(quiet),
            ]);
            assert.equal(
              runs.reduce((sum, run) => sum + run.enqueued, 0),
              1,
            );
            assert.equal((await enqueueNewBills(quiet)).enqueued, 0);
            const pending = (await outbox()).find(
              (row) => row.contentId === boundary,
            );
            assert.ok(pending);
            assert.equal(
              pending.notBefore.toISOString(),
              new Date(day.getTime() + 31 * 3600_000).toISOString(),
            );
            assert.equal((await drainOutbox(quiet)).sent, 0);
            await billSync(false);
            assert.equal((await device()).newBillsSubscribedAt, null);
            assert.equal((await outbox()).length, 1);
            assert.equal((await caller.history({ token: newToken })).length, 1);
            await billSync(true);
            assert.equal((await enqueueNewBills(quiet)).enqueued, 0);
            assert.equal(
              (await drainOutbox(new Date(day.getTime() + 31 * 3600_000))).sent,
              0,
            );

            await db.insert(NotificationOutbox).values({
              deviceId: newDevice,
              contentId: boundary,
              kind: "new_bill",
              title: "Stale subscription",
              body: "Stale subscription",
              href: `/article-detail?id=${boundary}`,
              createdAt: subscription,
              notBefore: new Date(0),
            });
            assert.equal((await drainOutbox()).sent, 0);
            await billSync(false);
            await db.insert(NotificationOutbox).values({
              deviceId: newDevice,
              contentId: futureId,
              kind: "new_bill",
              title: "Opted out",
              body: "Opted out",
              href: `/article-detail?id=${futureId}`,
              notBefore: new Date(0),
            });
            assert.equal((await drainOutbox()).sent, 0);
          } finally {
            await db.delete(PushDevice).where(eq(PushDevice.id, newDevice));
            if (billIds.length)
              await db.delete(Bill).where(inArray(Bill.id, billIds));
          }
        },
      );
      await t.test(
        "executive orders honor subscription, quiet hours, deduplication, opt-out and history",
        async () => {
          const execToken = `ExpoPushToken[${randomUUID()}]`;
          const execSync = (executiveOrders?: boolean) =>
            caller.sync({
              token: execToken,
              platform: "ios",
              timezone: "UTC",
              prefs: {
                ...prefs,
                following: false,
                executiveOrders,
                quietHours: true,
              },
              followIds: [],
            });
          const { deviceId: execDevice } = await execSync(true);
          deviceIds.push(execDevice);
          const [subscribed] = await db
            .select()
            .from(PushDevice)
            .where(eq(PushDevice.id, execDevice));
          assert.ok(subscribed?.executiveOrdersSubscribedAt);
          const start = subscribed.executiveOrdersSubscribedAt;
          const day = new Date(
            Date.UTC(
              start.getUTCFullYear(),
              start.getUTCMonth(),
              start.getUTCDate(),
            ),
          );
          const insertOrder = async (
            type: string,
            createdAt: Date,
            publishedDate = day,
          ) => {
            const id = randomUUID();
            orderIds.push(id);
            await db.insert(GovernmentContent).values({
              id,
              type,
              title: "Synthetic executive order",
              url: `https://example.com/${id}`,
              createdAt,
              publishedDate,
            });
            return id;
          };
          await insertOrder(
            "Executive Order",
            new Date(start.getTime() - 1000),
          );
          await insertOrder(
            "Executive Order",
            new Date(start.getTime() + 1000),
            new Date(day.getTime() - 86400000),
          );
          await insertOrder("Proclamation", new Date(start.getTime() + 1000));
          const id = await insertOrder(
            "Executive Order",
            new Date(start.getTime() + 1000),
          );
          // A UTC 23:00 run must hold delivery until 07:00 the next day.
          const now = new Date(day.getTime() + 23 * 3600000);
          const runs = await Promise.all([
            enqueueExecutiveOrders(now),
            enqueueExecutiveOrders(now),
          ]);
          assert.equal(
            runs.reduce((n, r) => n + r.enqueued, 0),
            1,
          );
          assert.equal((await enqueueExecutiveOrders(now)).enqueued, 0);
          assert.equal((await drainOutbox(now)).sent, 0);
          const [queued] = await db
            .select()
            .from(NotificationOutbox)
            .where(eq(NotificationOutbox.deviceId, execDevice));
          assert.equal(queued?.contentId, id);
          assert.equal(
            queued.notBefore.toISOString(),
            new Date(day.getTime() + 31 * 3600000).toISOString(),
          );
          await execSync(); // An old app's sync cannot erase an established opt-in.
          const [preserved] = await db
            .select()
            .from(PushDevice)
            .where(eq(PushDevice.id, execDevice));
          assert.equal(
            preserved?.executiveOrdersSubscribedAt?.getTime(),
            start.getTime(),
          );
          assert.equal(
            (await drainOutbox(new Date(day.getTime() + 31 * 3600000))).sent,
            1,
          );
          const history = await caller.history({ token: execToken });
          assert.equal(history.length, 1);
          assert.equal(history[0]?.kind, "executive");
          assert.equal(history[0].href, `/article-detail?id=${id}`);
          assert.equal(messages.at(-1)?.body, "Synthetic executive order");
          // Existing-source updates (including Federal Register reconciliation) cannot resend.
          await db
            .update(GovernmentContent)
            .set({ title: "Updated source title" })
            .where(eq(GovernmentContent.id, id));
          assert.equal((await enqueueExecutiveOrders(now)).enqueued, 0);
          await insertOrder(
            "Executive Order",
            new Date(start.getTime() + 2000),
          );
          assert.equal((await enqueueExecutiveOrders(now)).enqueued, 1);
          await execSync(false);
          assert.equal((await enqueueExecutiveOrders(now)).enqueued, 0);
          assert.equal(
            (await drainOutbox(new Date(day.getTime() + 31 * 3600000))).sent,
            0,
          );
          // Also reject a stale row at delivery, even if queued after cancellation.
          await db.insert(NotificationOutbox).values({
            deviceId: execDevice,
            contentId: randomUUID(),
            kind: "executive",
            title: "Stale",
            body: "Stale",
            href: "/",
            notBefore: now,
          });
          assert.equal(
            (await drainOutbox(new Date(day.getTime() + 31 * 3600000))).sent,
            0,
          );
          await execSync(false);
          // Resubscription starts from now, and does not replay archive records.
          await db
            .update(GovernmentContent)
            .set({ createdAt: new Date(start.getTime() - 1000) })
            .where(inArray(GovernmentContent.id, orderIds));
          await execSync(true);
          assert.equal((await enqueueExecutiveOrders(now)).enqueued, 0);
          await execSync(false);
        },
      );
      await t.test(
        "one worker run drains broadcasts across multiple Expo batches",
        async () => {
          const start = new Date();
          const day = new Date(
            Date.UTC(
              start.getUTCFullYear(),
              start.getUTCMonth(),
              start.getUTCDate(),
            ),
          );
          const ids = Array.from({ length: 105 }, () => randomUUID());
          deviceIds.push(...ids);
          await db.insert(PushDevice).values(
            ids.map((id) => ({
              id,
              expoPushToken: `ExpoPushToken[${id}]`,
              platform: "ios",
              timezone: "UTC",
              following: false,
              executiveOrdersSubscribedAt: start,
              quietHours: false,
            })),
          );
          const orderId = randomUUID();
          orderIds.push(orderId);
          await db.insert(GovernmentContent).values({
            id: orderId,
            title: "Broadcast order",
            type: "Executive Order",
            publishedDate: day,
            createdAt: new Date(),
            url: `https://example.com/${orderId}`,
          });
          const run = await runFollowNotifications();
          assert.equal(run.enqueued, 105);
          assert.equal(run.sent, 105);
          assert.equal((await runFollowNotifications()).sent, 0);
          await db
            .update(PushDevice)
            .set({ executiveOrdersSubscribedAt: null })
            .where(inArray(PushDevice.id, ids));
        },
      );
      await t.test(
        "rejected batches defer retries and cannot spin within a worker run",
        async () => {
          const id = randomUUID();
          deviceIds.push(id);
          await db.insert(PushDevice).values({
            id,
            expoPushToken: `ExpoPushToken[${id}]`,
            platform: "ios",
            timezone: "UTC",
            following: false,
            quietHours: false,
          });
          await db.insert(NotificationOutbox).values(
            Array.from({ length: 105 }, () => ({
              deviceId: id,
              kind: "test",
              title: "Rejected batch",
              body: "Synthetic",
              href: "/settings/notifications",
              notBefore: new Date(0),
            })),
          );
          reject = true;
          rejectError = "MessageRateExceeded";
          const before = messages.length;
          const run = await runFollowNotifications();
          assert.equal(run.failed, 105);
          assert.equal(messages.length - before, 105);
          assert.equal((await runFollowNotifications()).failed, 0);
          reject = false;
          rejectError = "DeviceNotRegistered";
          await db.delete(PushDevice).where(eq(PushDevice.id, id));
        },
      );
      await t.test(
        "a new bill action sends once and appears in server history",
        async () => {
          await db
            .update(Bill)
            .set({ lastActionAt: new Date("2026-01-02") })
            .where(eq(Bill.id, billId));
          assert.equal((await enqueueFollowMoves()).enqueued, 1);
          assert.equal((await drainOutbox()).sent, 1);
          assert.equal((await enqueueFollowMoves()).enqueued, 0);
          assert.equal((await caller.history({ token })).length, 1);
        },
      );
      await t.test("concurrent enqueuers record a bill move once", async () => {
        await db
          .update(Bill)
          .set({ lastActionAt: new Date("2026-01-03") })
          .where(eq(Bill.id, billId));
        const runs = await Promise.all([
          enqueueFollowMoves(),
          enqueueFollowMoves(),
        ]);
        assert.equal(
          runs.reduce((sum, run) => sum + run.enqueued, 0),
          1,
        );
        assert.equal((await drainOutbox()).sent, 1);
      });
      await t.test(
        "an hourly drain skips a test send already in flight",
        async () => {
          const id = await enqueueTestAlert(deviceId);
          let release: () => void = () => undefined;
          let entered: () => void = () => undefined;
          const gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          const sending = new Promise<void>((resolve) => {
            entered = resolve;
          });
          beforeSend = () => {
            entered();
            return gate;
          };
          const before = messages.length;
          const testSend = drainTestAlert(id);
          try {
            await sending;
            assert.equal((await drainOutbox()).sent, 0);
          } finally {
            release();
            beforeSend = undefined;
          }
          assert.equal((await testSend).sent, 1);
          assert.equal(messages.length - before, 1);
        },
      );
      await t.test(
        "a test waits for an hourly send and reports its existing success",
        async () => {
          const id = await enqueueTestAlert(deviceId);
          let release: () => void = () => undefined;
          let entered: () => void = () => undefined;
          const gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          const sending = new Promise<void>((resolve) => {
            entered = resolve;
          });
          beforeSend = () => {
            entered();
            return gate;
          };
          const before = messages.length;
          const hourly = drainOutbox();
          await sending;
          const testSend = drainTestAlert(id);
          release();
          beforeSend = undefined;
          assert.equal((await hourly).sent, 1);
          assert.equal((await testSend).sent, 1);
          assert.equal(messages.length - before, 1);
        },
      );
      await t.test(
        "a transport failure releases the row for a later retry",
        async () => {
          const id = await enqueueTestAlert(deviceId);
          beforeSend = () => Promise.reject(new Error("Transport unavailable"));
          await assert.rejects(drainTestAlert(id), /Transport unavailable/);
          beforeSend = undefined;
          assert.equal((await drainTestAlert(id)).sent, 1);
        },
      );
      await t.test(
        "opt-out cancels pending alerts even after opting in again",
        async () => {
          await queue();
          await sync(false);
          await sync(true);
          assert.equal((await drainOutbox()).sent, 0);
        },
      );
      await t.test(
        "unsaving cancels pending alerts even after resaving",
        async () => {
          await queue();
          await sync(true, []);
          await sync();
          assert.equal((await drainOutbox()).sent, 0);
        },
      );
      await t.test(
        "drain rechecks current preference and follow existence",
        async () => {
          await queue();
          await db
            .update(PushDevice)
            .set({ following: false })
            .where(eq(PushDevice.id, deviceId));
          assert.equal((await drainOutbox()).sent, 0);
          await db
            .update(PushDevice)
            .set({ following: true })
            .where(eq(PushDevice.id, deviceId));
          await db
            .delete(DeviceFollow)
            .where(eq(DeviceFollow.deviceId, deviceId));
          assert.equal((await drainOutbox()).sent, 0);
          await db
            .delete(NotificationOutbox)
            .where(eq(NotificationOutbox.deviceId, deviceId));
          await sync();
        },
      );
      await t.test(
        "test sends only itself, leaving quiet backlog and other devices alone",
        async () => {
          const future = new Date(Date.now() + 8 * 3600_000);
          await queue(future);
          const other = await caller.sync({
            token: `ExpoPushToken[${randomUUID()}]`,
            platform: "ios",
            timezone: "UTC",
            prefs,
            followIds: [billId],
          });
          deviceIds.push(other.deviceId);
          await queue(new Date(0), other.deviceId);
          const before = messages.length;
          assert.equal((await caller.test({ token, billId })).sent, 1);
          assert.equal(messages.length - before, 1);
          assert.equal(messages.at(-1)?.data.kind, "test");
          const pending = await db
            .select()
            .from(NotificationOutbox)
            .where(eq(NotificationOutbox.deviceId, deviceId));
          assert.equal(
            pending.find((row) => row.kind === "follow")?.notBefore.getTime(),
            future.getTime(),
          );
        },
      );
      await t.test(
        "Expo rejection is an API error and creates no successful history entry",
        async () => {
          const before = (await caller.history({ token })).length;
          reject = true;
          await assert.rejects(caller.test({ token }), /Expo did not accept/);
          assert.equal((await caller.history({ token })).length, before);
        },
      );
      await t.test(
        "receipts retry missing results, record failures, and disable unregistered devices",
        async () => {
          reject = false;
          await sync();
          const sentAt = new Date(Date.now() - 20 * 60_000);
          const accepted = [randomUUID(), randomUUID(), randomUUID()];
          for (const ticket of accepted)
            await db.insert(NotificationOutbox).values({
              deviceId,
              kind: "test",
              title: "Receipt fixture",
              body: "Test",
              href: "/settings/notifications",
              sentAt,
              ticket,
            });
          assert.equal((await checkPushReceipts()).checked, 0);
          receiptHttpError = true;
          await assert.rejects(checkPushReceipts(), /503/);
          receiptHttpError = false;
          const [ok, gone, invalid] = accepted;
          assert.ok(ok && gone && invalid);
          receipts[ok] = { status: "ok" };
          receipts[gone] = {
            status: "error",
            details: { error: "DeviceNotRegistered" },
          };
          receipts[invalid] = {
            status: "error",
            details: { error: "InvalidCredentials" },
            message: "APNs credentials rejected",
          };
          assert.deepEqual(await checkPushReceipts(), {
            checked: 3,
            failed: 2,
            unregistered: 1,
          });
          const [device] = await db
            .select()
            .from(PushDevice)
            .where(eq(PushDevice.id, deviceId));
          assert.ok(device?.disabledAt);
          const disabledTest = await enqueueTestAlert(deviceId);
          const sentBefore = messages.length;
          assert.equal((await drainTestAlert(disabledTest)).sent, 0);
          assert.equal(messages.length, sentBefore);
          const rows = await db
            .select()
            .from(NotificationOutbox)
            .where(inArray(NotificationOutbox.ticket, accepted));
          assert.ok(rows.every((row) => row.receiptCheckedAt));
          assert.match(
            rows.find((row) => row.ticket === invalid)?.error ?? "",
            /InvalidCredentials/,
          );
          const history = await caller.history({ token });
          assert.equal(
            history.filter((row) =>
              rows.some((receipt) => receipt.id === row.id),
            ).length,
            1,
          );
          const before = receiptRequests;
          assert.equal((await checkPushReceipts()).checked, 0);
          assert.equal(receiptRequests, before);
        },
      );
      await t.test(
        "an expired missing receipt is recorded as unknown rather than retried forever",
        async () => {
          const ticket = randomUUID();
          await db.insert(NotificationOutbox).values({
            deviceId,
            kind: "test",
            title: "Expired receipt",
            body: "Test",
            href: "/settings/notifications",
            sentAt: new Date(Date.now() - 25 * 3600_000),
            ticket,
          });
          assert.deepEqual(await checkPushReceipts(), {
            checked: 1,
            failed: 1,
            unregistered: 0,
          });
          const [row] = await db
            .select()
            .from(NotificationOutbox)
            .where(eq(NotificationOutbox.ticket, ticket));
          assert.match(row?.error ?? "", /delivery unknown/);
          assert.ok(row?.receiptCheckedAt);
        },
      );
    } finally {
      if (deviceIds.length)
        await db.delete(PushDevice).where(inArray(PushDevice.id, deviceIds));
      await db.delete(Bill).where(eq(Bill.id, billId));
      if (orderIds.length)
        await db
          .delete(GovernmentContent)
          .where(inArray(GovernmentContent.id, orderIds));
      await (db as typeof db & { $client: Pool }).$client.end();
    }
  },
);
