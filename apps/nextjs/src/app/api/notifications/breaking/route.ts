import { NextResponse } from "next/server";

import { BreakingAlertSchema, sendBreakingAlert } from "~/server/notifications";
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

  const parsed = BreakingAlertSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid alert", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await sendBreakingAlert(parsed.data));
  } catch (error) {
    console.error("breaking notification send failed", error);
    return NextResponse.json(
      { error: "Could not send alert" },
      { status: 502 },
    );
  }
}
