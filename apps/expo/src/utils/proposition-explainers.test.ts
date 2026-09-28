import assert from "node:assert/strict";
import test from "node:test";

import {
  propositionDetailRoute,
  submittedGuideArguments,
} from "./proposition-explainers";

test("navigation carries only the proposition number", () => {
  assert.deepEqual(propositionDetailRoute("5"), {
    pathname: "/proposition-detail",
    params: { number: "5" },
  });
});

test("a guide notice about absent arguments does not become advocacy text", () => {
  assert.deepEqual(
    submittedGuideArguments([
      { text: "NO ARGUMENT AGAINST PROPOSITION 1 WAS SUBMITTED." },
      { text: "A submitted argument" },
    ]),
    [{ text: "A submitted argument" }],
  );
});
