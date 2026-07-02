import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { publicProcedure } from "../trpc";

const RESEND_API_BASE_URL = "https://api.resend.com";

const CATEGORY_LABEL: Record<"bug" | "idea" | "content", string> = {
  bug: "Bug report",
  idea: "Feature idea",
  content: "Content issue",
};

const FeedbackInputSchema = z.object({
  category: z.enum(["bug", "idea", "content"]),
  message: z.string().trim().min(5).max(4000),
  appVersion: z.string().max(80).optional(),
  buildNumber: z.string().max(80).nullable().optional(),
  platform: z.string().max(80).optional(),
  platformVersion: z.string().max(80).optional(),
});

export const feedbackRouter = {
  submit: publicProcedure
    .input(FeedbackInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await sendFeedbackEmail({
          ...input,
          userId: ctx.session?.user.id,
          userEmail: ctx.session?.user.email,
        });
        return { success: true };
      } catch (error) {
        console.error("feedback submission failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not send feedback",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;

interface FeedbackEmailInput extends z.infer<typeof FeedbackInputSchema> {
  userId?: string;
  userEmail?: string | null;
}

async function sendFeedbackEmail(input: FeedbackEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const to = feedbackRecipients();
  if (to.length === 0) {
    throw new Error("FEEDBACK_TO_EMAIL is not configured");
  }

  const category = CATEGORY_LABEL[input.category];
  const subject = `[Billion feedback] ${category}`;
  const from =
    process.env.FEEDBACK_FROM_EMAIL ??
    "Billion Feedback <onboarding@resend.dev>";

  const metadata = [
    ["Category", category],
    ["App version", input.appVersion],
    ["Build", input.buildNumber ?? undefined],
    ["Platform", input.platform],
    ["Platform version", input.platformVersion],
    ["User ID", input.userId],
    ["User email", input.userEmail ?? undefined],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  const text = [
    subject,
    "",
    input.message,
    "",
    "Metadata",
    ...metadata.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

  const html = `
    <h2>${escapeHtml(subject)}</h2>
    <p>${escapeHtml(input.message).replace(/\n/g, "<br />")}</p>
    <h3>Metadata</h3>
    <ul>
      ${metadata
        .map(
          ([label, value]) =>
            `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`,
        )
        .join("")}
    </ul>
  `;

  const response = await fetch(`${RESEND_API_BASE_URL}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Resend email failed (${response.status}): ${detail}`);
  }
}

function feedbackRecipients() {
  const raw = process.env.FEEDBACK_TO_EMAIL ?? "thatxliner@gmail.com";
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
