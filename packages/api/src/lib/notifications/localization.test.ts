import assert from "node:assert/strict";
import test from "node:test";

import { localDecisionAlertCopy } from "./copy";
import { localizeAlertHistory } from "./localization";

void test("local alert history preserves official source titles and translates known templates", async () => {
  const title = "Official City Council matter title";
  for (const language of ["es", "zh"] as const) {
    const rows = await localizeAlertHistory(
      ["outcome", "cancelled", "schedule"].map((change) => ({
        id: change,
        ...localDecisionAlertCopy(
          { id: "decision", title },
          change === "outcome"
            ? "outcome"
            : change === "cancelled"
              ? "cancelled"
              : "schedule",
        ),
      })),
      language,
    );
    for (const row of rows) {
      assert.equal(row.title, title);
      assert.equal(row.translationState, "translated");
      assert.ok(!row.body.includes("Open for details"));
    }
  }
});
