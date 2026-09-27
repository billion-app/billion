import { SIGNAL_CATEGORY } from "./copy";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/;

export function isExpoPushToken(value: string): boolean {
  return TOKEN_RE.test(value.trim());
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: { href: string; kind: string; test?: boolean };
  categoryId: string;
  sound: null;
  interruptionLevel: "active";
  channelId: string;
}

export function expoPushMessage(input: {
  to: string;
  title: string;
  body: string;
  href: string;
  kind: string;
  test?: boolean;
}): ExpoPushMessage {
  return {
    to: input.to,
    title: input.title,
    body: input.body,
    data: input.test
      ? { href: input.href, kind: input.kind, test: true }
      : { href: input.href, kind: input.kind },
    categoryId: SIGNAL_CATEGORY,
    sound: null,
    interruptionLevel: "active",
    channelId: "billion-signal",
  };
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export async function sendExpoPush(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];
  const tickets: ExpoPushTicket[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };
    const access = process.env.EXPO_ACCESS_TOKEN;
    if (access) headers.Authorization = `Bearer ${access}`;
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Expo push HTTP ${response.status}: ${text.slice(0, 240)}`,
      );
    }
    const json = (await response.json()) as {
      data?: ExpoPushTicket | ExpoPushTicket[];
    };
    const data = json.data;
    if (Array.isArray(data)) tickets.push(...data);
    else if (data) tickets.push(data);
  }
  return tickets;
}

export function isUnregisteredTicket(ticket: ExpoPushTicket): boolean {
  return ticket.details?.error === "DeviceNotRegistered";
}

/** Lookup provider handoff results, keyed by the previously accepted ticket. */
export async function getExpoPushReceipts(
  ids: string[],
): Promise<Record<string, ExpoPushTicket>> {
  if (!ids.length) return {};
  if (ids.length > 1000)
    throw new Error("Expo accepts at most 1000 receipt IDs per request");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN)
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
    method: "POST",
    headers,
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Expo receipts HTTP ${response.status}`);
  const json = (await response.json()) as {
    data?: Record<string, ExpoPushTicket>;
    errors?: { message?: string }[];
  };
  if (!json.data || json.errors?.length)
    throw new Error("Expo receipt lookup failed");
  return json.data;
}
