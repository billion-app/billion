import assert from "node:assert/strict";
import test from "node:test";

import { civicProviderErrorMessage } from "./civic-provider-error";

void test("provider errors retain a useful code without exposing credentials", () => {
  const message = civicProviderErrorMessage(403, "Forbidden", {
    error: {
      status: "PERMISSION_DENIED",
      message: "Consumer api_key:secret-value has been suspended",
    },
  });

  assert.equal(
    message,
    "Google Civic API request failed: 403 Forbidden (PERMISSION_DENIED)",
  );
  assert.equal(message.includes("secret-value"), false);
});
