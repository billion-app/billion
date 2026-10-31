const transientNetworkCodes = new Set([
  "ABORT_ERR",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ETIMEDOUT",
  "ERR_STREAM_PREMATURE_CLOSE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
]);
const transientHttpStatuses = new Set([408, 429, 500, 502, 503, 504]);

export class CaliforniaSourceUnavailable extends Error {
  constructor(url: string, cause: unknown) {
    super(`Source acquisition unavailable (${url})`, { cause });
    this.name = "CaliforniaSourceUnavailable";
  }
}

export class CaliforniaSourceHttpError extends Error {
  readonly resource?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    public readonly status: number,
    diagnostic?: {
      resource?: string;
      retryAfterSeconds?: string | number | null;
    },
  ) {
    let resource: string | undefined;
    try {
      const url = new URL(diagnostic?.resource ?? "");
      if (["http:", "https:"].includes(url.protocol))
        resource = `${url.origin}${url.pathname}`;
    } catch {
      resource = undefined;
    }
    const value = diagnostic?.retryAfterSeconds;
    const retry =
      typeof value === "number"
        ? value
        : typeof value === "string" && /^\d+$/.test(value)
          ? Number(value)
          : undefined;
    const retryAfterSeconds =
      retry !== undefined &&
      Number.isSafeInteger(retry) &&
      retry >= 0 &&
      retry <= 86_400
        ? retry
        : undefined;
    super(
      `Source request failed (${status})${resource ? `; source ${resource}` : ""}${retryAfterSeconds !== undefined ? `; retry after ${retryAfterSeconds} seconds` : ""}`,
    );
    this.resource = resource;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function transientNetworkFailure(
  error: unknown,
  seen = new Set<unknown>(),
): boolean {
  if (!(error instanceof Error) || seen.has(error)) return false;
  seen.add(error);
  if (error instanceof AggregateError)
    return (
      error.errors.length > 0 &&
      error.errors.every((value) =>
        transientNetworkFailure(value, new Set(seen)),
      )
    );
  const code = (error as NodeJS.ErrnoException).code;
  if (typeof code === "string") return transientNetworkCodes.has(code);
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  return (
    error.cause !== undefined && transientNetworkFailure(error.cause, seen)
  );
}

export function sourceAcquisitionFailure(url: string, error: unknown): unknown {
  return transientNetworkFailure(error)
    ? new CaliforniaSourceUnavailable(url, error)
    : error;
}

export function isCaliforniaSourceUnavailable(error: unknown): boolean {
  return (
    error instanceof CaliforniaSourceUnavailable ||
    (error instanceof CaliforniaSourceHttpError &&
      transientHttpStatuses.has(error.status))
  );
}
