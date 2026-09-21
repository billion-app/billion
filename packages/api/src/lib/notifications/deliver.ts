import {
  and,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  DeviceFollow,
  NotificationOutbox,
  PushDevice,
} from "@acme/db/schema";

import { followAlertCopy, TEST_ALERT_COPY } from "./copy";
import {
  expoPushMessage,
  isUnregisteredTicket,
  sendExpoPush,
} from "./expo-push";
import { nextDeliveryAt } from "./quiet-hours";

export interface FollowNotificationRun {
  enqueued: number;
  sent: number;
  failed: number;
  unregistered: number;
}

export async function enqueueFollowMoves(
  now = new Date(),
): Promise<{ enqueued: number }> {
  const due = await db
    .select({
      followId: DeviceFollow.id,
      deviceId: DeviceFollow.deviceId,
      contentId: DeviceFollow.contentId,
      lastNotifiedActionAt: DeviceFollow.lastNotifiedActionAt,
      lastActionAt: Bill.lastActionAt,
      billId: Bill.id,
      title: Bill.title,
      billNumber: Bill.billNumber,
      status: Bill.status,
      actions: Bill.actions,
      quietHours: PushDevice.quietHours,
      quietStartMin: PushDevice.quietStartMin,
      quietEndMin: PushDevice.quietEndMin,
      timezone: PushDevice.timezone,
    })
    .from(DeviceFollow)
    .innerJoin(PushDevice, eq(PushDevice.id, DeviceFollow.deviceId))
    .innerJoin(Bill, eq(Bill.id, DeviceFollow.contentId))
    .where(
      and(
        eq(PushDevice.following, true),
        isNull(PushDevice.disabledAt),
        eq(DeviceFollow.contentType, "bill"),
        isNotNull(Bill.lastActionAt),
        or(
          isNull(DeviceFollow.lastNotifiedActionAt),
          // Bill timestamps are stored as UTC without a time zone; compare
          // instants explicitly so the DB session zone cannot replay a move.
          sql`${Bill.lastActionAt} AT TIME ZONE 'UTC' > ${DeviceFollow.lastNotifiedActionAt}`,
        ),
      ),
    );

  let enqueued = 0;
  for (const row of due) {
    if (!row.lastActionAt) continue;
    const copy = followAlertCopy({
      id: row.billId,
      title: row.title,
      billNumber: row.billNumber,
      status: row.status,
      actions: row.actions,
    });
    const notBefore = nextDeliveryAt(now, {
      quietHours: row.quietHours,
      quietStartMin: row.quietStartMin,
      quietEndMin: row.quietEndMin,
      timezone: row.timezone,
    });
    await db.insert(NotificationOutbox).values({
      deviceId: row.deviceId,
      kind: copy.kind,
      title: copy.title,
      body: copy.body,
      href: copy.href,
      contentId: row.contentId,
      notBefore,
    });
    await db
      .update(DeviceFollow)
      .set({ lastNotifiedActionAt: row.lastActionAt })
      .where(eq(DeviceFollow.id, row.followId));
    enqueued += 1;
  }
  return { enqueued };
}

export async function enqueueTestAlert(
  deviceId: string,
  bill?: {
    id: string;
    title: string;
    billNumber: string;
    status?: string | null;
    actions?:
      | { date: string; text: string; type?: string; actionCode?: string }[]
      | null;
  },
  now = new Date(),
): Promise<string> {
  const copy = bill ? followAlertCopy(bill) : TEST_ALERT_COPY;
  const [row] = await db
    .insert(NotificationOutbox)
    .values({
      deviceId,
      kind: "test",
      title: copy.title,
      body: copy.body,
      href: copy.href,
      contentId: bill?.id,
      notBefore: now,
    })
    .returning({ id: NotificationOutbox.id });
  if (!row) throw new Error("Could not queue the test alert.");
  return row.id;
}

export async function drainOutbox(
  now = new Date(),
  outboxId?: string,
): Promise<Omit<FollowNotificationRun, "enqueued">> {
  const due = await db
    .select({
      id: NotificationOutbox.id,
      deviceId: NotificationOutbox.deviceId,
      kind: NotificationOutbox.kind,
      title: NotificationOutbox.title,
      body: NotificationOutbox.body,
      href: NotificationOutbox.href,
      token: PushDevice.expoPushToken,
    })
    .from(NotificationOutbox)
    .innerJoin(PushDevice, eq(PushDevice.id, NotificationOutbox.deviceId))
    .where(
      and(
        isNull(NotificationOutbox.sentAt),
        isNull(PushDevice.disabledAt),
        lte(NotificationOutbox.notBefore, now),
        outboxId ? eq(NotificationOutbox.id, outboxId) : undefined,
        or(
          ne(NotificationOutbox.kind, "follow"),
          and(
            eq(PushDevice.following, true),
            exists(
              db
                .select({ id: DeviceFollow.id })
                .from(DeviceFollow)
                .where(
                  and(
                    eq(DeviceFollow.deviceId, NotificationOutbox.deviceId),
                    eq(DeviceFollow.contentId, NotificationOutbox.contentId),
                  ),
                ),
            ),
          ),
        ),
      ),
    )
    .limit(200);

  if (due.length === 0) return { sent: 0, failed: 0, unregistered: 0 };

  const messages = due.map((row) =>
    expoPushMessage({
      to: row.token,
      title: row.title,
      body: row.body,
      href: row.href,
      kind: row.kind,
      test: row.kind === "test",
    }),
  );

  const tickets = await sendExpoPush(messages);
  let sent = 0;
  let failed = 0;
  let unregistered = 0;
  const disableIds = new Set<string>();

  for (let i = 0; i < due.length; i++) {
    const row = due[i];
    if (!row) continue;
    const ticket = tickets[i];
    if (!ticket || ticket.status === "error") {
      failed += 1;
      if (ticket && isUnregisteredTicket(ticket)) {
        unregistered += 1;
        disableIds.add(row.deviceId);
      }
      await db
        .update(NotificationOutbox)
        .set({
          error: ticket?.message ?? "Expo push returned no ticket",
        })
        .where(eq(NotificationOutbox.id, row.id));
      continue;
    }
    sent += 1;
    await db
      .update(NotificationOutbox)
      .set({
        sentAt: now,
        ticket: ticket.id ?? null,
        error: null,
      })
      .where(eq(NotificationOutbox.id, row.id));
  }

  if (disableIds.size > 0) {
    await db
      .update(PushDevice)
      .set({ disabledAt: now })
      .where(inArray(PushDevice.id, [...disableIds]));
  }

  return { sent, failed, unregistered };
}

export async function runFollowNotifications(
  now = new Date(),
): Promise<FollowNotificationRun> {
  const { enqueued } = await enqueueFollowMoves(now);
  const drained = await drainOutbox(now);
  return { enqueued, ...drained };
}

/** Send only the newly queued test; leave quiet-hours backlog untouched. */
export async function drainTestAlert(outboxId: string, now = new Date()) {
  return drainOutbox(now, outboxId);
}
