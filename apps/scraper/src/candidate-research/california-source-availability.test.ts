import assert from "node:assert/strict";
import test from "node:test";

import {
  CaliforniaSourceHttpError,
  isCaliforniaSourceUnavailable,
} from "./california-source-availability.js";

test("HTTP diagnostics preserve legacy status and remove credentials and queries", () => {
  const legacy = new CaliforniaSourceHttpError(429);
  assert.equal(legacy.message, "Source request failed (429)");
  assert.equal(isCaliforniaSourceUnavailable(legacy), true);
  const error = new CaliforniaSourceHttpError(429, {
    resource:
      "https://user:password@api.open.fec.gov/v1/filings/?api_key=secret&token=private#fragment",
    retryAfterSeconds: "60",
  });
  assert.equal(error.resource, "https://api.open.fec.gov/v1/filings/");
  assert.equal(error.retryAfterSeconds, 60);
  assert.equal(isCaliforniaSourceUnavailable(error), true);
  assert.match(error.message, /retry after 60 seconds/);
  for (const secret of ["user", "password", "secret", "private", "fragment"])
    assert.equal(error.message.includes(secret), false);
});

test("invalid resource and retry diagnostics do not change source failure classification", () => {
  for (const retryAfterSeconds of [
    -1,
    1.2,
    86401,
    "1\nInjected",
    "tomorrow",
    "-1",
    null,
  ]) {
    const error = new CaliforniaSourceHttpError(503, {
      resource: "malformed URL",
      retryAfterSeconds,
    });
    assert.equal(error.resource, undefined);
    assert.equal(error.retryAfterSeconds, undefined);
    assert.equal(error.message, "Source request failed (503)");
    assert.equal(isCaliforniaSourceUnavailable(error), true);
  }
  assert.equal(
    new CaliforniaSourceHttpError(429, { retryAfterSeconds: 0 })
      .retryAfterSeconds,
    0,
  );
  assert.equal(
    new CaliforniaSourceHttpError(429, { retryAfterSeconds: "86400" })
      .retryAfterSeconds,
    86400,
  );
});
