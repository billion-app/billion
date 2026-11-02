export interface CaliforniaFecRetryFact {
  resource: string;
  attemptedAt: string;
  retryAfterSeconds: number;
  notBefore: string;
}

export type CaliforniaFecRetry =
  | CaliforniaFecRetryFact
  | {
      invalid: true;
      reason: string;
      attemptedAt?: string;
      observed?: CaliforniaFecRetryFact;
    };

const invalidReason =
  "Retained FEC retry metadata is invalid; finance research deferred";
const resourcePattern =
  /^https:\/\/api\.open\.fec\.gov\/v1\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?$/;
const diagnosticPattern =
  /^Source request failed \(429\); source (\S+); retry after (0|[1-9]\d*) seconds$/;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function instant(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : undefined;
}

function fact(value: unknown, now: string): CaliforniaFecRetryFact | undefined {
  const input = record(value);
  if (!input) return undefined;
  const attemptedAt = instant(input.attemptedAt);
  const current = instant(now);
  if (
    typeof input.resource !== "string" ||
    !resourcePattern.test(input.resource) ||
    typeof input.attemptedAt !== "string" ||
    typeof input.notBefore !== "string" ||
    attemptedAt === undefined ||
    current === undefined ||
    attemptedAt > current ||
    typeof input.retryAfterSeconds !== "number" ||
    !Number.isSafeInteger(input.retryAfterSeconds) ||
    input.retryAfterSeconds < 0 ||
    input.retryAfterSeconds > 86_400 ||
    instant(input.notBefore) !== attemptedAt + input.retryAfterSeconds * 1000
  )
    return undefined;
  return {
    resource: input.resource,
    attemptedAt: input.attemptedAt,
    retryAfterSeconds: input.retryAfterSeconds,
    notBefore: input.notBefore,
  };
}

function invalid(
  attemptedAt: unknown,
): Extract<CaliforniaFecRetry, { invalid: true }> {
  return {
    invalid: true,
    reason: invalidReason,
    ...(typeof attemptedAt === "string" ? { attemptedAt } : {}),
  };
}

export function mergeCaliforniaFecRetry(
  first: CaliforniaFecRetry | undefined,
  second: CaliforniaFecRetry | undefined,
): CaliforniaFecRetry | undefined {
  if (!first) return second;
  if (!second) return first;
  const firstFact = "invalid" in first ? first.observed : first;
  const secondFact = "invalid" in second ? second.observed : second;
  const observed =
    !firstFact ||
    (secondFact &&
      Date.parse(secondFact.notBefore) > Date.parse(firstFact.notBefore))
      ? secondFact
      : firstFact;
  const invalidState =
    "invalid" in first ? first : "invalid" in second ? second : undefined;
  return invalidState
    ? { ...invalidState, ...(observed ? { observed } : {}) }
    : observed;
}

export function readCaliforniaFecRetry(
  checkpoint: unknown,
  now: string,
): CaliforniaFecRetry | undefined {
  const input = record(checkpoint);
  if (!input) return undefined;
  let retained: CaliforniaFecRetry | undefined;
  if (input.fecRetry !== undefined) {
    const saved = record(input.fecRetry);
    if (saved?.invalid === true) {
      const observed = fact(saved.observed, now);
      retained = {
        ...invalid(saved.attemptedAt),
        ...(observed ? { observed } : {}),
      };
    } else {
      retained = fact(input.fecRetry, now) ?? invalid(saved?.attemptedAt);
    }
  }
  if (typeof input.reason !== "string") return retained;
  const resource = /^Source request failed \(429\); source ([^;\s]+)/.exec(
    input.reason,
  )?.[1];
  if (!resource) return retained;
  let knownFec = false;
  try {
    knownFec = new URL(resource).hostname.toLowerCase() === "api.open.fec.gov";
  } catch {
    knownFec = /^https?:\/\/api\.open\.fec\.gov(?:[/:?#]|$)/i.test(resource);
  }
  if (!knownFec) return retained;
  const match = diagnosticPattern.exec(input.reason);
  const attemptedAt = instant(input.attemptedAt);
  const retryAfterSeconds = match ? Number(match[2]) : undefined;
  const observed =
    attemptedAt !== undefined &&
    retryAfterSeconds !== undefined &&
    Number.isSafeInteger(retryAfterSeconds) &&
    retryAfterSeconds >= 0 &&
    retryAfterSeconds <= 86_400
      ? fact(
          {
            resource,
            attemptedAt: input.attemptedAt,
            retryAfterSeconds,
            notBefore: new Date(
              attemptedAt + retryAfterSeconds * 1000,
            ).toJSON(),
          },
          now,
        )
      : undefined;
  return mergeCaliforniaFecRetry(
    retained,
    observed ?? invalid(input.attemptedAt),
  );
}

export function californiaFecRetryDeferReason(
  state: CaliforniaFecRetry | undefined,
  now: string,
): string | undefined {
  if (!state) return undefined;
  if ("invalid" in state) return state.reason;
  const safeNotBefore = Date.parse(state.notBefore) + 60_000;
  if (Date.parse(now) < safeNotBefore)
    return `Previously observed FEC API retry window remains active until ${new Date(safeNotBefore).toISOString()}; finance research deferred`;
  return undefined;
}
