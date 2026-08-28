import { NextResponse } from "next/server";
import { z } from "zod/v4";

import type { MailingListSignupPlatform } from "./waitlist-confirmation-email";
import { env } from "~/env";
import { isAndroidUserAgent } from "../../_lib/platform";
import { mailingListConfirmationEmail } from "./waitlist-confirmation-email";

export const runtime = "nodejs";

const RESEND_API_BASE_URL = "https://api.resend.com";

const CreateMailingListSignupSchema = z.object({
  email: z.email().max(320),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateMailingListSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  let result: MailingListSignupResult;

  try {
    result = await addMailingListContact(email);
  } catch (err) {
    console.error("mailing list resend contact failed", err);
    return NextResponse.json(
      { error: "Could not join the mailing list" },
      { status: 500 },
    );
  }

  // A confirmation is transactional: it is sent only once, when the Contact
  // is first created. A delivery problem should never prevent someone from
  // joining the mailing list.
  if (result === "joined") {
    // Read from the signup request rather than passed by the form: the header
    // is what actually says which device is in someone's hand, and it covers
    // every form on the site without each one having to declare itself.
    const platform: MailingListSignupPlatform = isAndroidUserAgent(
      req.headers.get("user-agent"),
    )
      ? "android"
      : "default";

    await sendMailingListConfirmation(email, platform).catch((err: unknown) => {
      console.error("mailing list confirmation email failed", err);
    });
  }

  return NextResponse.json({ ok: true, result });
}

async function sendMailingListConfirmation(
  email: string,
  platform: MailingListSignupPlatform,
) {
  const from = env.RESEND_MAILING_LIST_CONFIRMATION_FROM_EMAIL;
  if (!from) return;

  const { subject, text, html } = mailingListConfirmationEmail(platform);

  const response = await fetch(`${RESEND_API_BASE_URL}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text,
      html,
    }),
  });

  if (response.ok) return;

  throwResendError([["send confirmation", await parseResendError(response)]]);
}

async function addMailingListContact(
  email: string,
): Promise<MailingListSignupResult> {
  const segmentId = env.RESEND_GENERAL_UPDATES_SEGMENT_ID;
  const topicId = env.RESEND_GENERAL_UPDATES_TOPIC_ID;
  const encodedEmail = encodeURIComponent(email);
  const topics = topicId
    ? [{ id: topicId, subscription: "opt_in" as const }]
    : undefined;

  const existing = await resendRequest("GET", `/contacts/${encodedEmail}`);
  if (!existing.error) {
    await updateMailingListContact(encodedEmail, segmentId, topics);
    return "already_joined";
  }

  if (existing.error.statusCode !== 404) {
    throwResendError([["lookup", existing.error]]);
  }

  const created = await resendRequest("POST", "/contacts", {
    email,
    ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
    ...(topics ? { topics } : {}),
    unsubscribed: false,
  });

  if (created.error) {
    throwResendError([["create", created.error]]);
  }

  return "joined";
}

async function updateMailingListContact(
  encodedEmail: string,
  segmentId: string | undefined,
  topics: GeneralUpdatesTopic[] | undefined,
) {
  const updated = await resendRequest("PATCH", `/contacts/${encodedEmail}`, {
    unsubscribed: false,
  });

  if (updated.error) throwResendError([["update", updated.error]]);

  if (segmentId) {
    await ensureSegment(encodedEmail, segmentId);
  }

  await ensureGeneralUpdatesTopic(encodedEmail, topics);
}

async function ensureSegment(encodedEmail: string, segmentId: string) {
  const segmented = await resendRequest(
    "POST",
    `/contacts/${encodedEmail}/segments/${encodeURIComponent(segmentId)}`,
  );

  if (!segmented.error || segmented.error.statusCode === 409) return;

  throwResendError([["add segment", segmented.error]]);
}

async function ensureGeneralUpdatesTopic(
  encodedEmail: string,
  topics: GeneralUpdatesTopic[] | undefined,
) {
  if (!topics) return;

  const updatedTopics = await resendRequest(
    "PATCH",
    `/contacts/${encodedEmail}/topics`,
    topics,
  );

  if (!updatedTopics.error) return;

  throwResendError([["update topics", updatedTopics.error]]);
}

function throwResendError(
  errors: [action: string, error: ResendError][],
): never {
  throw new Error(
    errors
      .map(([action, error]) => formatResendError(action, error))
      .join("; "),
  );
}

type ResendRequestMethod = "GET" | "POST" | "PATCH";

type MailingListSignupResult = "joined" | "already_joined";

interface ResendError {
  message: string;
  name: string;
  statusCode: number | null;
}

type ResendResult = { error: null } | { error: ResendError };

interface GeneralUpdatesTopic {
  id: string;
  subscription: "opt_in";
}

async function resendRequest(
  method: ResendRequestMethod,
  path: string,
  body?: unknown,
): Promise<ResendResult> {
  const res = await fetch(`${RESEND_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.ok) return { error: null };

  return { error: await parseResendError(res) };
}

async function parseResendError(res: Response): Promise<ResendError> {
  const fallback: ResendError = {
    message: res.statusText || "Resend request failed",
    name: "application_error",
    statusCode: res.status,
  };

  const data: unknown = await res.json().catch(() => null);
  if (!isRecord(data)) return fallback;

  return {
    message: typeof data.message === "string" ? data.message : fallback.message,
    name: typeof data.name === "string" ? data.name : fallback.name,
    statusCode:
      typeof data.statusCode === "number"
        ? data.statusCode
        : fallback.statusCode,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatResendError(action: string, error: ResendError) {
  return `${action} failed: ${error.name} (${error.statusCode ?? "unknown"}): ${
    error.message
  }`;
}
