import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActionSourceUrl,
  collectCongressActions,
  parseCongressBillUrl,
} from "./congress.js";

void test("buildActionSourceUrl creates the stable Congress.gov action record URL", () => {
  assert.equal(
    buildActionSourceUrl(
      "https://www.congress.gov/bill/119th-congress/house-bill/4090",
    ),
    "https://www.congress.gov/bill/119th-congress/house-bill/4090/all-actions",
  );
});

void test("parseCongressBillUrl resolves supported canonical bill URLs", () => {
  assert.deepEqual(
    parseCongressBillUrl(
      "https://www.congress.gov/bill/119th-congress/house-bill/4090",
    ),
    { congress: 119, billType: "hr", billNumber: "4090" },
  );
  assert.equal(
    parseCongressBillUrl("https://www.congress.gov/committee/house-energy"),
    undefined,
  );
});

void test("collectCongressActions keeps citations aligned across pages", async () => {
  const requestedOffsets: number[] = [];
  const billUrl =
    "https://www.congress.gov/bill/119th-congress/house-bill/4090";

  const actions = await collectCongressActions(async (offset) => {
    requestedOffsets.push(offset);
    if (offset === 0) {
      return {
        actions: [
          {
            actionDate: "2026-02-05",
            text: "Received in the Senate.",
            type: "IntroReferral",
            actionCode: "H11100",
            sourceSystem: { code: 2, name: "House floor actions" },
            recordedVotes: [
              {
                rollNumber: 55,
                url: "https://clerk.house.gov/Votes/202655",
              },
            ],
          },
          {
            actionDate: "2026-02-04",
            text: "Passed House.",
            type: "Floor",
          },
        ],
        pagination: { count: 3 },
      };
    }

    return {
      actions: [
        {
          actionDate: "2025-06-24",
          text: "Introduced in House.",
          type: "IntroReferral",
        },
      ],
      pagination: { count: 3 },
    };
  }, billUrl);

  assert.deepEqual(requestedOffsets, [0, 2]);
  assert.deepEqual(
    actions.map(({ date, text, sourceUrl, textKind }) => ({
      date,
      text,
      sourceUrl,
      textKind,
    })),
    [
      {
        date: "2026-02-05",
        text: "Received in the Senate.",
        sourceUrl: "https://clerk.house.gov/Votes/202655",
        textKind: "official",
      },
      {
        date: "2026-02-04",
        text: "Passed House.",
        sourceUrl: `${billUrl}/all-actions`,
        textKind: "official",
      },
      {
        date: "2025-06-24",
        text: "Introduced in House.",
        sourceUrl: `${billUrl}/all-actions`,
        textKind: "official",
      },
    ],
  );
  assert.equal(
    actions[0]?.sourceLocator,
    "2026-02-05 · House floor actions · action code H11100 · roll call 55",
  );
});
