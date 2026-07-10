import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { env } from "~/env";

export const runtime = "nodejs";

const RESEND_API_BASE_URL = "https://api.resend.com";

const CreateWaitlistSchema = z.object({
  email: z.email().max(320),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  let result: WaitlistSignupResult;

  try {
    result = await addWaitlistContact(email);
  } catch (err) {
    console.error("waitlist resend contact failed", err);
    return NextResponse.json(
      { error: "Could not join waitlist" },
      { status: 500 },
    );
  }

  // A confirmation is transactional: it is sent only once, when the Contact
  // is first created. A delivery problem should never prevent someone from
  // joining the waitlist.
  if (result === "joined") {
    await sendWaitlistConfirmation(email).catch((err: unknown) => {
      console.error("waitlist confirmation email failed", err);
    });
  }

  return NextResponse.json({ ok: true, result });
}

async function sendWaitlistConfirmation(email: string) {
  const from = env.RESEND_WAITLIST_CONFIRMATION_FROM_EMAIL;
  if (!from) return;

  const response = await fetch(`${RESEND_API_BASE_URL}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "You're on the Billion waitlist",
      text: "You're on the Billion waitlist. We'll email you when there's an update. Thanks for being early.",
      html: [
        "<p>You're on the Billion waitlist.</p>",
        "<p>We'll email you when there's an update. Thanks for being early.</p>",
      ].join(""),
    }),
  });

  if (response.ok) return;

  throwResendError([["send confirmation", await parseResendError(response)]]);
}

async function addWaitlistContact(
  email: string,
): Promise<WaitlistSignupResult> {
  const segmentId = env.RESEND_WAITLIST_SEGMENT_ID;
  const topicId = env.RESEND_LAUNCH_UPDATES_TOPIC_ID;
  const encodedEmail = encodeURIComponent(email);
  const topics = topicId
    ? [{ id: topicId, subscription: "opt_in" as const }]
    : undefined;

  const existing = await resendRequest("GET", `/contacts/${encodedEmail}`);
  if (!existing.error) {
    await updateWaitlistContact(encodedEmail, segmentId, topics);
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

async function updateWaitlistContact(
  encodedEmail: string,
  segmentId: string | undefined,
  topics: WaitlistTopic[] | undefined,
) {
  const updated = await resendRequest("PATCH", `/contacts/${encodedEmail}`, {
    unsubscribed: false,
  });

  if (updated.error) throwResendError([["update", updated.error]]);

  if (segmentId) {
    await ensureWaitlistSegment(encodedEmail, segmentId);
  }

  await ensureLaunchUpdatesTopic(encodedEmail, topics);
}

async function ensureWaitlistSegment(encodedEmail: string, segmentId: string) {
  const segmented = await resendRequest(
    "POST",
    `/contacts/${encodedEmail}/segments/${encodeURIComponent(segmentId)}`,
  );

  if (!segmented.error || segmented.error.statusCode === 409) return;

  throwResendError([["add segment", segmented.error]]);
}

async function ensureLaunchUpdatesTopic(
  encodedEmail: string,
  topics: WaitlistTopic[] | undefined,
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

type WaitlistSignupResult = "joined" | "already_joined";

interface ResendError {
  message: string;
  name: string;
  statusCode: number | null;
}

type ResendResult = { error: null } | { error: ResendError };

interface WaitlistTopic {
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
