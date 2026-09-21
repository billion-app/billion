import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";

import { eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  DeviceFollow,
  NotificationOutbox,
  PushDevice,
} from "@acme/db/schema";

import type { ExpoPushMessage } from "./expo-push";
import { notificationsRouter } from "../../router/notifications";
import { createTRPCRouter } from "../../trpc";
import { drainOutbox, enqueueFollowMoves } from "./deliver";

// Run only against an explicitly selected, migrated, disposable local database.
const databaseUrl = process.env.NOTIFICATIONS_TEST_DATABASE_URL;
void test(
  "notification delivery and API regressions",
  { skip: !databaseUrl },
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
    t.mock.method(globalThis, "fetch", (url: string, init: RequestInit) => {
      assert.equal(url, "https://exp.host/--/api/v2/push/send");
      assert.equal(typeof init.body, "string");
      const batch = JSON.parse(init.body as string) as ExpoPushMessage[];
      messages.push(...batch);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: batch.map(() =>
              reject
                ? {
                    status: "error",
                    message: "Device not registered",
                    details: { error: "DeviceNotRegistered" },
                  }
                : { status: "ok", id: randomUUID() },
            ),
          }),
        ),
      );
    });
    const billId = randomUUID();
    const deviceIds: string[] = [];
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
    } finally {
      if (deviceIds.length)
        await db.delete(PushDevice).where(inArray(PushDevice.id, deviceIds));
      await db.delete(Bill).where(eq(Bill.id, billId));
      await (db as typeof db & { $client: Pool }).$client.end();
    }
  },
);
