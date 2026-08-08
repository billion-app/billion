import assert from "node:assert/strict";
import test from "node:test";

import { parseFeed } from "./whitehouse.js";

/** Shaped like the live presidential-actions feed, trimmed to what we read. */
function feed(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel><title>Presidential Actions</title>${items}</channel>
</rss>`;
}

function item(options: {
  title: string;
  categories: string[];
  pubDate?: string;
  link?: string;
  body?: string;
}): string {
  return `<item>
    <title>${options.title}</title>
    <link>${options.link ?? "https://www.whitehouse.gov/presidential-actions/2026/08/x/"}</link>
    <pubDate>${options.pubDate ?? "Thu, 06 Aug 2026 21:07:11 +0000"}</pubDate>
    ${options.categories.map((c) => `<category><![CDATA[${c}]]></category>`).join("")}
    <content:encoded><![CDATA[${options.body ?? "<p>Body</p>"}]]></content:encoded>
  </item>`;
}

void test("an executive order is mapped to the Federal Register's vocabulary", () => {
  const items = parseFeed(
    feed(
      item({
        title: "Ending Birth Tourism",
        categories: ["Presidential Actions", "Executive Orders"],
        body: "<p>By the authority vested in me</p>",
      }),
    ),
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, "Ending Birth Tourism");
  // Singular, matching what federalregister.ts writes, so one card type covers
  // both sources rather than "Executive Order" and "Executive Orders" both
  // existing in the same column.
  assert.equal(items[0]?.type, "Executive Order");
  assert.equal(
    items[0]?.publishedDate.toISOString().slice(0, 10),
    "2026-08-06",
  );
  assert.match(items[0]?.bodyHtml ?? "", /authority vested/);
});

void test("nominations are not stored", () => {
  // Bare lists of nominee names: nothing to summarise, and each one ingested
  // would draw a brief, a dual-lens pass and header art.
  const items = parseFeed(
    feed(
      item({
        title: "Nominations Sent to the Senate",
        categories: ["Presidential Actions", "Nominations & Appointments"],
      }),
    ),
  );

  assert.deepEqual(items, []);
});

void test("the specific category is found whatever its position", () => {
  const items = parseFeed(
    feed(
      item({
        title: "Made in America Week, 2026",
        categories: ["Proclamations", "Presidential Actions"],
      }),
    ),
  );

  assert.equal(items[0]?.type, "Proclamation");
});

void test("an item with no recognised category is left alone", () => {
  // The feed carries post types we have no mapping for. Storing them under a
  // catch-all would put uncategorised posts in the feed as presidential
  // actions, so they are dropped until someone maps them deliberately.
  const items = parseFeed(
    feed(
      item({
        title: "Something New",
        categories: ["Presidential Actions", "Briefing Room"],
      }),
    ),
  );

  assert.deepEqual(items, []);
});

void test("an unparseable date is dropped rather than stored as now", () => {
  // publishedDate drives the feed ordering, so defaulting a bad date to the
  // current time would float a broken item to the top of the app.
  const items = parseFeed(
    feed(
      item({
        title: "Ending Birth Tourism",
        categories: ["Executive Orders"],
        pubDate: "not a date",
      }),
    ),
  );

  assert.deepEqual(items, []);
});

void test("every storable item in a mixed feed is returned", () => {
  const items = parseFeed(
    feed(
      [
        item({
          title: "Ending Birth Tourism",
          categories: ["Executive Orders"],
          link: "https://www.whitehouse.gov/presidential-actions/2026/08/ending-birth-tourism/",
        }),
        item({
          title: "Nominations Sent to the Senate",
          categories: ["Nominations & Appointments"],
        }),
        item({
          title: "A Memorandum",
          categories: ["Presidential Memoranda"],
        }),
      ].join(""),
    ),
  );

  assert.deepEqual(
    items.map((entry) => entry.type),
    ["Executive Order", "Memorandum"],
  );
  assert.equal(
    items[0]?.url,
    "https://www.whitehouse.gov/presidential-actions/2026/08/ending-birth-tourism/",
  );
});
