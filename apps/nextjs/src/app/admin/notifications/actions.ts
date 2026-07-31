"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill } from "@acme/db/schema";

import { requireNotificationAdmin } from "~/auth/admin";
import {
  checkNotificationReceipts,
  sendBreakingAlert,
} from "~/server/notifications";

export interface AdminActionState {
  status: "idle" | "success" | "error";
  message?: string;
  resetKey?: string;
}

const AdminAlertSchema = z.object({
  contentId: z.uuid(),
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(240),
  confirmation: z.literal("confirmed"),
});

export async function sendAdminAlert(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const operator = await requireNotificationAdmin();
    const parsed = AdminAlertSchema.safeParse({
      contentId: formData.get("contentId"),
      title: formData.get("title"),
      body: formData.get("body"),
      confirmation: formData.get("confirmation"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message:
          parsed.error.issues[0]?.message ??
          "Choose a bill and confirm the send.",
      };
    }

    const [bill] = await db
      .select({ id: Bill.id })
      .from(Bill)
      .where(eq(Bill.id, parsed.data.contentId))
      .limit(1);
    if (!bill) {
      return { status: "error", message: "That bill no longer exists." };
    }

    const result = await sendBreakingAlert({
      title: parsed.data.title,
      body: parsed.data.body,
      contentId: bill.id,
      route: `/article-detail?id=${bill.id}`,
      idempotencyKey: `admin:${bill.id}:${randomUUID()}`,
      operatorUserId: operator.id,
      operatorEmail: operator.email,
    });

    revalidatePath("/admin/notifications");
    const recipients = "recipients" in result ? result.recipients : 0;
    return {
      status: "success",
      message: `Alert sent to ${recipients} opted-in device${recipients === 1 ? "" : "s"}.`,
      resetKey: result.alertId,
    };
  } catch (error) {
    console.error("admin notification send failed", error);
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not send the alert.",
    };
  }
}

export async function refreshAdminReceipts(
  _previous: AdminActionState,
): Promise<AdminActionState> {
  try {
    await requireNotificationAdmin();
    const result = await checkNotificationReceipts();
    revalidatePath("/admin/notifications");
    return {
      status: "success",
      message: `Checked ${result.checked} receipt${result.checked === 1 ? "" : "s"}; ${result.pending} still pending.`,
    };
  } catch (error) {
    console.error("admin receipt check failed", error);
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not check receipts.",
    };
  }
}
