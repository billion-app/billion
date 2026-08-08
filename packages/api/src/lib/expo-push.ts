const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_MESSAGES_PER_REQUEST = 100;
const MAX_RECEIPTS_PER_REQUEST = 1_000;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
  data?: Record<string, unknown>;
}

export type ExpoPushTicket =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message: string;
      details?: { error?: string };
    };

export type ExpoPushReceipt =
  | { status: "ok" }
  | {
      status: "error";
      message: string;
      details?: { error?: string };
    };

export interface TicketResult {
  token: string;
  ticket: ExpoPushTicket;
}

export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<TicketResult[]> {
  const results: TicketResult[] = [];

  for (const chunk of chunks(messages, MAX_MESSAGES_PER_REQUEST)) {
    const response = await fetchImpl(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(expoErrorMessage(payload, response.status));
    }

    const tickets = readTickets(payload);
    if (tickets.length !== chunk.length) {
      throw new Error(
        `Expo returned ${tickets.length} tickets for ${chunk.length} messages`,
      );
    }

    for (const [index, ticket] of tickets.entries()) {
      const message = chunk[index];
      if (!message) {
        throw new Error("Expo returned a ticket without a matching message");
      }
      results.push({ token: message.to, ticket });
    }
  }

  return results;
}

export async function getExpoPushReceipts(
  ticketIds: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, ExpoPushReceipt>> {
  const receipts: Record<string, ExpoPushReceipt> = {};

  for (const chunk of chunks(ticketIds, MAX_RECEIPTS_PER_REQUEST)) {
    const response = await fetchImpl(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: chunk }),
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(expoErrorMessage(payload, response.status));
    }

    Object.assign(receipts, readReceipts(payload));
  }

  return receipts;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function readTickets(payload: unknown): ExpoPushTicket[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("Expo returned an invalid push ticket response");
  }
  return payload.data.map(parseTicket);
}

function readReceipts(payload: unknown): Record<string, ExpoPushReceipt> {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error("Expo returned an invalid push receipt response");
  }

  return Object.fromEntries(
    Object.entries(payload.data).map(([id, value]) => [
      id,
      parseReceipt(value),
    ]),
  );
}

function parseTicket(value: unknown): ExpoPushTicket {
  if (!isRecord(value) || (value.status !== "ok" && value.status !== "error")) {
    throw new Error("Expo returned an invalid push ticket");
  }
  if (value.status === "ok" && typeof value.id === "string") {
    return { status: "ok", id: value.id };
  }
  if (value.status === "error" && typeof value.message === "string") {
    return {
      status: "error",
      message: value.message,
      details: readDetails(value.details),
    };
  }
  throw new Error("Expo returned an incomplete push ticket");
}

function parseReceipt(value: unknown): ExpoPushReceipt {
  if (!isRecord(value) || (value.status !== "ok" && value.status !== "error")) {
    throw new Error("Expo returned an invalid push receipt");
  }
  if (value.status === "ok") return { status: "ok" };
  if (typeof value.message !== "string") {
    throw new Error("Expo returned an incomplete push receipt");
  }
  return {
    status: "error",
    message: value.message,
    details: readDetails(value.details),
  };
}

function readDetails(value: unknown): { error?: string } | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.error === "string" ? { error: value.error } : undefined;
}

function expoErrorMessage(payload: unknown, status: number): string {
  if (
    isRecord(payload) &&
    Array.isArray(payload.errors) &&
    isRecord(payload.errors[0]) &&
    typeof payload.errors[0].message === "string"
  ) {
    return payload.errors[0].message;
  }
  return `Expo push request failed with HTTP ${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
