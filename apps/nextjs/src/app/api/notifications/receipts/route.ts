import { NextResponse } from "next/server";

import { checkNotificationReceipts } from "~/server/notifications";
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

  try {
    return NextResponse.json(await checkNotificationReceipts());
  } catch (error) {
    console.error("notification receipt check failed", error);
    return NextResponse.json(
      { error: "Could not check receipts" },
      { status: 502 },
    );
  }
}
