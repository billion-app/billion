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
