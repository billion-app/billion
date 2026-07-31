import { NextResponse } from "next/server";

import { getExpoPushReceipts } from "@acme/api/lib/expo-push";
import { and, eq, isNotNull } from "@acme/db";
import { db } from "@acme/db/client";
import { NotificationDelivery, PushDevice } from "@acme/db/schema";

import {
  isNotificationOperatorAuthorized,
  isNotificationServiceConfigured,
} from "../_lib/authorize";

export const runtime = "nodejs";

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
    return NextResponse.json({ ok: true, checked: 0, pending: 0 });
  }

  try {
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

    return NextResponse.json({
      ok: true,
      checked: delivered + failed,
      delivered,
      failed,
      pending: ticketIds.length - delivered - failed,
    });
  } catch (error) {
    console.error("notification receipt check failed", error);
    return NextResponse.json(
      { error: "Could not check receipts" },
      { status: 502 },
    );
  }
}
