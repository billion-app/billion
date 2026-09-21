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
  getExpoPushReceipts,
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
  return db.transaction(async (tx) => {
    const due = await tx
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
      )
      .for("update", { of: DeviceFollow, skipLocked: true });

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
      await tx.insert(NotificationOutbox).values({
        deviceId: row.deviceId,
        kind: copy.kind,
        title: copy.title,
        body: copy.body,
        href: copy.href,
        contentId: row.contentId,
        notBefore,
      });
      await tx
        .update(DeviceFollow)
        .set({ lastNotifiedActionAt: row.lastActionAt })
        .where(eq(DeviceFollow.id, row.followId));
      enqueued += 1;
    }
    return { enqueued };
  });
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
  return db.transaction(async (tx) => {
    const due = await tx
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
                tx
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
      // One Expo request per transaction: commit accepted tickets before the
      // next batch, and let other workers skip rows this worker already owns.
      .limit(100)
      .for(
        "update",
        outboxId
          ? { of: NotificationOutbox }
          : { of: NotificationOutbox, skipLocked: true },
      );

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
        await tx
          .update(NotificationOutbox)
          .set({
            error: ticket?.message ?? "Expo push returned no ticket",
          })
          .where(eq(NotificationOutbox.id, row.id));
        continue;
      }
      sent += 1;
      await tx
        .update(NotificationOutbox)
        .set({
          sentAt: now,
          ticket: ticket.id ?? null,
          error: null,
        })
        .where(eq(NotificationOutbox.id, row.id));
    }

    if (disableIds.size > 0) {
      await tx
        .update(PushDevice)
        .set({ disabledAt: now })
        .where(inArray(PushDevice.id, [...disableIds]));
    }

    return { sent, failed, unregistered };
  });
}

export async function runFollowNotifications(
  now = new Date(),
): Promise<FollowNotificationRun & { receipts: ReceiptCheckRun }> {
  const receipts = await checkPushReceipts(now);
  const { enqueued } = await enqueueFollowMoves(now);
  const drained = await drainOutbox(now);
  return { enqueued, ...drained, receipts };
}

/** Send only the newly queued test; leave quiet-hours backlog untouched. */
export async function drainTestAlert(outboxId: string, now = new Date()) {
  const result = await drainOutbox(now, outboxId);
  if (result.sent || result.failed) return result;
  // An hourly worker may have held this row while the test request waited.
  const [row] = await db
    .select()
    .from(NotificationOutbox)
    .where(eq(NotificationOutbox.id, outboxId));
  return row?.sentAt && !row.error
    ? { sent: 1, failed: 0, unregistered: 0 }
    : result;
}

export interface ReceiptCheckRun {
  checked: number;
  failed: number;
  unregistered: number;
}

/** Expo recommends checking after 15 minutes; receipts expire after 24 hours. */
export async function checkPushReceipts(
  now = new Date(),
): Promise<ReceiptCheckRun> {
  return db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(NotificationOutbox)
      .where(
        and(
          isNotNull(NotificationOutbox.ticket),
          isNull(NotificationOutbox.receiptCheckedAt),
          lte(NotificationOutbox.sentAt, new Date(now.getTime() - 15 * 60_000)),
        ),
      )
      .orderBy(NotificationOutbox.sentAt)
      .limit(1000)
      .for("update", { skipLocked: true });
    if (!pending.length) return { checked: 0, failed: 0, unregistered: 0 };
    const ids = pending.flatMap((row) => (row.ticket ? [row.ticket] : []));
    const receipts = await getExpoPushReceipts(ids);
    const result = { checked: 0, failed: 0, unregistered: 0 };
    for (const row of pending) {
      const receipt = row.ticket ? receipts[row.ticket] : undefined;
      const expired =
        row.sentAt && now.getTime() - row.sentAt.getTime() >= 24 * 3600_000;
      if (!receipt && !expired) continue;
      const error =
        receipt?.status === "ok"
          ? null
          : receipt
            ? `${receipt.details?.error ?? "PushDeliveryFailed"}: ${receipt.message ?? "Push provider rejected the notification"}`
            : "Push receipt unavailable after 24 hours; delivery unknown";
      await tx
        .update(NotificationOutbox)
        .set({ receiptCheckedAt: now, error })
        .where(eq(NotificationOutbox.id, row.id));
      result.checked++;
      if (error) result.failed++;
      if (receipt && isUnregisteredTicket(receipt)) {
        await tx
          .update(PushDevice)
          .set({ disabledAt: now })
          .where(eq(PushDevice.id, row.deviceId));
        result.unregistered++;
      }
    }
    return result;
  });
}
