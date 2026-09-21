import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq, inArray, isNotNull, isNull } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  DeviceFollow,
  NotificationOutbox,
  PushDevice,
} from "@acme/db/schema";

import { drainTestAlert, enqueueTestAlert } from "../lib/notifications/deliver";
import { isExpoPushToken } from "../lib/notifications/expo-push";
import { clampMinutes } from "../lib/notifications/quiet-hours";
import { publicProcedure } from "../trpc";

const TokenInput = z
  .string()
  .trim()
  .max(200)
  .refine(isExpoPushToken, "must be an Expo push token");

const PrefsInput = z.object({
  breaking: z.boolean(),
  following: z.boolean(),
  brief: z.boolean(),
  recap: z.boolean(),
  quietHours: z.boolean(),
  quietStartMin: z.number().int(),
  quietEndMin: z.number().int(),
});

async function requireDevice(token: string) {
  const [row] = await db
    .select()
    .from(PushDevice)
    .where(eq(PushDevice.expoPushToken, token))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This phone is not registered for alerts yet.",
    });
  }
  return row;
}

export const notificationsRouter = {
  /**
   * Register or refresh this phone. The Expo token is the credential —
   * there is no account yet, and follows already live on the device.
   */
  sync: publicProcedure
    .input(
      z.object({
        token: TokenInput,
        platform: z.enum(["ios", "android"]),
        timezone: z.string().trim().min(1).max(64),
        prefs: PrefsInput,
        followIds: z.array(z.string().uuid()).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const prefs = {
        breaking: input.prefs.breaking,
        following: input.prefs.following,
        brief: input.prefs.brief,
        recap: input.prefs.recap,
        quietHours: input.prefs.quietHours,
        quietStartMin: clampMinutes(input.prefs.quietStartMin),
        quietEndMin: clampMinutes(input.prefs.quietEndMin),
      };
      const userId = ctx.session?.user.id ?? null;
      const [existing] = await db
        .select({ id: PushDevice.id })
        .from(PushDevice)
        .where(eq(PushDevice.expoPushToken, input.token))
        .limit(1);

      let deviceId = existing?.id;
      if (deviceId) {
        await db
          .update(PushDevice)
          .set({
            platform: input.platform,
            timezone: input.timezone,
            userId,
            ...prefs,
            lastSeenAt: new Date(),
            disabledAt: null,
          })
          .where(eq(PushDevice.id, deviceId));
      } else {
        const [created] = await db
          .insert(PushDevice)
          .values({
            expoPushToken: input.token,
            platform: input.platform,
            timezone: input.timezone,
            userId,
            ...prefs,
          })
          .returning({ id: PushDevice.id });
        deviceId = created?.id;
      }
      if (!deviceId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not register this phone.",
        });
      }

      await syncFollows(deviceId, input.followIds);
      if (!prefs.following) {
        await db
          .delete(NotificationOutbox)
          .where(
            and(
              eq(NotificationOutbox.deviceId, deviceId),
              eq(NotificationOutbox.kind, "follow"),
              isNull(NotificationOutbox.sentAt),
            ),
          );
      }
      return { ok: true as const, deviceId };
    }),

  unregister: publicProcedure
    .input(z.object({ token: TokenInput }))
    .mutation(async ({ input }) => {
      await db
        .update(PushDevice)
        .set({ disabledAt: new Date() })
        .where(eq(PushDevice.expoPushToken, input.token));
      return { ok: true as const };
    }),

  test: publicProcedure
    .input(
      z.object({
        token: TokenInput,
        billId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const device = await requireDevice(input.token);
      let bill:
        | {
            id: string;
            title: string;
            billNumber: string;
            status: string | null;
            actions:
              | {
                  date: string;
                  text: string;
                  type?: string;
                  actionCode?: string;
                }[]
              | null;
          }
        | undefined;
      if (input.billId) {
        const [row] = await db
          .select({
            id: Bill.id,
            title: Bill.title,
            billNumber: Bill.billNumber,
            status: Bill.status,
            actions: Bill.actions,
          })
          .from(Bill)
          .where(eq(Bill.id, input.billId))
          .limit(1);
        bill = row;
      }
      const outboxId = await enqueueTestAlert(device.id, bill);
      const drained = await drainTestAlert(outboxId);
      if (drained.sent !== 1) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message:
            "Expo did not accept the test notification. Check notification permissions and try again.",
        });
      }
      return { ok: true as const, ...drained };
    }),

  history: publicProcedure
    .input(z.object({ token: TokenInput }))
    .query(async ({ input }) => {
      const device = await requireDevice(input.token);
      const rows = await db
        .select({
          id: NotificationOutbox.id,
          at: NotificationOutbox.sentAt,
          kind: NotificationOutbox.kind,
          title: NotificationOutbox.title,
          body: NotificationOutbox.body,
          href: NotificationOutbox.href,
        })
        .from(NotificationOutbox)
        .where(
          and(
            eq(NotificationOutbox.deviceId, device.id),
            isNotNull(NotificationOutbox.sentAt),
            isNull(NotificationOutbox.error),
          ),
        )
        .orderBy(desc(NotificationOutbox.sentAt))
        .limit(50);
      return rows.map((row) => ({
        id: row.id,
        at: row.at?.toISOString() ?? new Date().toISOString(),
        kind: row.kind,
        title: row.title,
        body: row.body,
        href: row.href,
      }));
    }),
} satisfies TRPCRouterRecord;

async function syncFollows(deviceId: string, followIds: string[]) {
  const unique = [...new Set(followIds)];
  const existing = await db
    .select({
      id: DeviceFollow.id,
      contentId: DeviceFollow.contentId,
    })
    .from(DeviceFollow)
    .where(eq(DeviceFollow.deviceId, deviceId));
  const existingIds = new Set(existing.map((row) => row.contentId));
  const wanted = new Set(unique);

  const removed = existing
    .filter((row) => !wanted.has(row.contentId))
    .map((row) => row.id);
  if (removed.length > 0) {
    await db.delete(NotificationOutbox).where(
      and(
        eq(NotificationOutbox.deviceId, deviceId),
        eq(NotificationOutbox.kind, "follow"),
        isNull(NotificationOutbox.sentAt),
        inArray(
          NotificationOutbox.contentId,
          existing
            .filter((row) => !wanted.has(row.contentId))
            .map((row) => row.contentId),
        ),
      ),
    );
    await db.delete(DeviceFollow).where(inArray(DeviceFollow.id, removed));
  }

  const added = unique.filter((id) => !existingIds.has(id));
  if (added.length === 0) return;

  const bills = await db
    .select({ id: Bill.id, lastActionAt: Bill.lastActionAt })
    .from(Bill)
    .where(inArray(Bill.id, added));
  if (bills.length === 0) return;

  await db
    .insert(DeviceFollow)
    .values(
      bills.map((bill) => ({
        deviceId,
        contentId: bill.id,
        contentType: "bill" as const,
        lastNotifiedActionAt: bill.lastActionAt,
      })),
    )
    .onConflictDoNothing();
}
