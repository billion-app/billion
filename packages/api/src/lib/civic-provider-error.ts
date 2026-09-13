function providerStatus(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return null;
  }

  const error = payload.error;
  if (!error || typeof error !== "object" || !("status" in error)) {
    return null;
  }

  return typeof error.status === "string" ? error.status : null;
}

export function civicProviderErrorMessage(
  status: number,
  statusText: string,
  payload: unknown,
): string {
  const code = providerStatus(payload);
  return `Google Civic API request failed: ${status} ${statusText}${code ? ` (${code})` : ""}`;
}
