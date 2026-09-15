// Process environment only; load authorized local configuration with @acme/env/load.
const endpoint = "https://www.googleapis.com/civicinfo/v2/elections";
const result = {
  checkedAt: new Date().toISOString(),
  endpoint,
  httpStatus: null,
};
const key = process.env.GOOGLE_CIVIC_API_KEY;
if (!key) {
  result.outcome = "missing_credential";
} else {
  const url = new URL(endpoint);
  url.searchParams.set("key", key);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    result.httpStatus = response.status;
    const body = await response.json();
    const reasons = body.error?.errors?.map((e) => e.reason) ?? [];
    result.outcome = reasons.includes("accessNotConfigured")
      ? "api_access_not_configured"
      : reasons.includes("keyInvalid")
        ? "invalid_key"
        : !response.ok || body.error
          ? "provider_error"
          : "endpoint_accessible";
    if (result.outcome === "endpoint_accessible")
      result.electionCount = Array.isArray(body.elections)
        ? body.elections.length
        : 0;
  } catch {
    result.outcome = "transport_or_response_error";
  }
}
console.log(JSON.stringify(result, null, 2));
if (result.outcome !== "endpoint_accessible") process.exitCode = 2;
