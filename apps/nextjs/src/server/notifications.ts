import "server-only";

import { z } from "zod/v4";

import {
  getExpoPushReceipts,
  sendExpoPushMessages,
} from "@acme/api/lib/expo-push";
import { and, eq, isNotNull } from "@acme/db";
import { db } from "@acme/db/client";
import {
  NotificationAlert,
  NotificationDelivery,
  PushDevice,
} from "@acme/db/schema";

export const BreakingAlertSchema = z.object({
  title: z.string().trim().min(1).max(100).default("BREAKING"),
  body: z.string().trim().min(1).max(240),
  contentId: z.uuid().optional(),
  route: z.string().trim().startsWith("/").max(500),
  idempotencyKey: z.string().trim().min(8).max(160),
  operatorUserId: z.string().trim().min(1).optional(),
  operatorEmail: z.email().optional(),
});

export async function sendBreakingAlert(
  input: z.infer<typeof BreakingAlertSchema>,
) {
  const [created] = await db
    .insert(NotificationAlert)
    .values(input)
    .onConflictDoNothing({ target: NotificationAlert.idempotencyKey })
    .returning();

  const alert =
    created ??
    (
      await db
        .select()
        .from(NotificationAlert)
        .where(eq(NotificationAlert.idempotencyKey, input.idempotencyKey))
        .limit(1)
    )[0];

  if (!alert) throw new Error("Could not create alert");
  if (!created) {
    return {
      ok: true as const,
      duplicate: true as const,
      alertId: alert.id,
      status: alert.status,
    };
  }

  const devices = await db
    .select({
      id: PushDevice.id,
      expoPushToken: PushDevice.expoPushToken,
    })
    .from(PushDevice)
    .where(
      and(eq(PushDevice.enabled, true), eq(PushDevice.breakingNews, true)),
    );

  if (devices.length === 0) {
    await db
      .update(NotificationAlert)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(NotificationAlert.id, alert.id));
    return { ok: true as const, alertId: alert.id, recipients: 0 };
  }

  await db.insert(NotificationDelivery).values(
    devices.map((device) => ({
      alertId: alert.id,
      deviceId: device.id,
    })),
  );
  await db
    .update(NotificationAlert)
    .set({ status: "sending" })
    .where(eq(NotificationAlert.id, alert.id));

  try {
    const tickets = await sendExpoPushMessages(
      devices.map((device) => ({
        to: device.expoPushToken,
        title: input.title,
        body: input.body,
        sound: "default",
        priority: "high",
        channelId: "breaking-news",
        data: {
          type: "bill",
          alertId: alert.id,
          contentId: input.contentId,
          route: input.route,
        },
      })),
    );

    const deviceByToken = new Map(
      devices.map((device) => [device.expoPushToken, device]),
    );
    let accepted = 0;

    for (const result of tickets) {
      const device = deviceByToken.get(result.token);
      if (!device) continue;

      if (result.ticket.status === "ok") {
        accepted += 1;
        await db
          .update(NotificationDelivery)
          .set({
            expoTicketId: result.ticket.id,
            status: "ticketed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(NotificationDelivery.alertId, alert.id),
              eq(NotificationDelivery.deviceId, device.id),
            ),
          );
      } else {
        await db
          .update(NotificationDelivery)
          .set({
            status: "failed",
            error: result.ticket.message,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(NotificationDelivery.alertId, alert.id),
              eq(NotificationDelivery.deviceId, device.id),
            ),
          );

        if (result.ticket.details?.error === "DeviceNotRegistered") {
          await db
            .update(PushDevice)
            .set({ enabled: false, updatedAt: new Date() })
            .where(eq(PushDevice.id, device.id));
        }
      }
    }

    await db
      .update(NotificationAlert)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(NotificationAlert.id, alert.id));

    return {
      ok: true as const,
      alertId: alert.id,
      recipients: devices.length,
      accepted,
      rejected: devices.length - accepted,
    };
  } catch (error) {
    await db
      .update(NotificationAlert)
      .set({ status: "failed" })
      .where(eq(NotificationAlert.id, alert.id));
    throw error;
  }
}

export async function checkNotificationReceipts() {
  const deliveries = await db
    .select({
      id: NotificationDelivery.id,
      deviceId: NotificationDelivery.deviceId,
      expoTicketId: NotificationDelivery.expoTicketId,
    })
    .from(NotificationDelivery)
    .where(
      and(
        eq(NotificationDelivery.status, "ticketed"),
        isNotNull(NotificationDelivery.expoTicketId),
      ),
    );

  const ticketIds = deliveries
    .map((delivery) => delivery.expoTicketId)
    .filter((id): id is string => Boolean(id));

  if (ticketIds.length === 0) {
    return { ok: true as const, checked: 0, pending: 0 };
  }

  const receipts = await getExpoPushReceipts(ticketIds);
  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const ticketId = delivery.expoTicketId;
    if (!ticketId) continue;
    const receipt = receipts[ticketId];
    if (!receipt) continue;

    if (receipt.status === "ok") {
      delivered += 1;
      await db
        .update(NotificationDelivery)
        .set({ status: "delivered", error: null, updatedAt: new Date() })
        .where(eq(NotificationDelivery.id, delivery.id));
    } else {
      failed += 1;
      await db
        .update(NotificationDelivery)
        .set({
          status: "failed",
          error: receipt.message,
          updatedAt: new Date(),
        })
        .where(eq(NotificationDelivery.id, delivery.id));

      if (receipt.details?.error === "DeviceNotRegistered") {
        await db
          .update(PushDevice)
          .set({ enabled: false, updatedAt: new Date() })
          .where(eq(PushDevice.id, delivery.deviceId));
      }
    }
  }

  return {
    ok: true as const,
    checked: delivered + failed,
    delivered,
    failed,
    pending: ticketIds.length - delivered - failed,
  };
}
