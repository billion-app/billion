import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { sendExpoPushMessages } from "@acme/api/lib/expo-push";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  NotificationAlert,
  NotificationDelivery,
  PushDevice,
} from "@acme/db/schema";

import {
  isNotificationOperatorAuthorized,
  isNotificationServiceConfigured,
} from "../_lib/authorize";

export const runtime = "nodejs";

const BreakingAlertSchema = z.object({
  title: z.string().trim().min(1).max(100).default("BREAKING"),
  body: z.string().trim().min(1).max(240),
  contentId: z.uuid().optional(),
  route: z.string().trim().startsWith("/").max(500),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export async function POST(request: Request) {
  if (!isNotificationServiceConfigured()) {
    return NextResponse.json(
      { error: "Notifications are not configured" },
      { status: 503 },
    );
  }
  if (!isNotificationOperatorAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BreakingAlertSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid alert", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const input = parsed.data;
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

  if (!alert) {
    return NextResponse.json(
      { error: "Could not create alert" },
      { status: 500 },
    );
  }
  if (!created) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      alertId: alert.id,
      status: alert.status,
    });
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
    return NextResponse.json({
      ok: true,
      alertId: alert.id,
      recipients: 0,
    });
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

    return NextResponse.json({
      ok: true,
      alertId: alert.id,
      recipients: devices.length,
      accepted,
      rejected: devices.length - accepted,
    });
  } catch (error) {
    await db
      .update(NotificationAlert)
      .set({ status: "failed" })
      .where(eq(NotificationAlert.id, alert.id));
    console.error("breaking notification send failed", error);
    return NextResponse.json(
      { error: "Could not send alert", alertId: alert.id },
      { status: 502 },
    );
  }
}
