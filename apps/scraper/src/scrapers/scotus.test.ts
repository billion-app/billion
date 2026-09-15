import assert from "node:assert/strict";
import test from "node:test";

import { scrapers } from "../scrapers.js";
import {
  collectScotusCases,
  parseOpinionIndex,
  termYear,
} from "./scotus-source.js";
import { storeScotusCases } from "./scotus.js";

const base = "https://www.supremecourt.gov";
const pdf = `${base}/opinions/25pdf/26a305_4g15.pdf`;
// The Court publishes a row for each justice's opinion, even when they link
// to the same combined PDF. This is the ruling in the reported mail-ballot story.
const orders = `<table><tr><th>Date</th><th>Docket</th><th>Name</th><th>J.</th></tr>
<tr><td>9/14/26</td><td>26A305</td><td><a href="/opinions/25pdf/26a305_4g15.pdf">Postal Service v. California</a></td><td>BK</td></tr>
<tr><td>9/14/26</td><td>26A305</td><td><a href="/opinions/25pdf/26a305_4g15.pdf">Postal Service v. California</a></td><td>A</td></tr></table>`;
const slip = `<table><tr><th>R-</th><th>Date</th><th>Docket</th><th>Name</th></tr>
<tr><td>69</td><td>8/24/26</td><td>26A124</td><td><a href="/opinions/25pdf/26a124_hgci.pdf" title="Application for stay granted.">Trump v. California</a></td></tr></table>`;
const empty = `<table><tr><th>Date</th><th>Docket</th><th>Name</th></tr></table>`;

void test("the mail-ballot ruling is reachable through the active runner", () => {
  assert.ok(scrapers.find((scraper) => scraper.id === "scotus"));
});

void test("official emergency ruling reaches court-case input once, with decision date and complete source", async () => {
  const requests: string[] = [];
  const text =
    "The application for stay is denied. " +
    "Source text. ".repeat(1500) +
    "JUSTICE ALITO, dissenting.";
  const cases = await collectScotusCases(1, new Date("2026-09-15"), {
    fetch: async (url) => {
      requests.push(url);
      if (url === pdf) return new Response("pdf fixture");
      return new Response(
        url.endsWith("/24")
          ? empty
          : url.includes("relatingtoorders")
            ? orders
            : slip,
      );
    },
    readPdf: async () => text,
  });
  assert.equal(cases.length, 1);
  assert.equal(cases[0]?.caseNumber, "26A305");
  assert.equal(cases[0]?.court, "Supreme Court of the United States");
  assert.equal(cases[0]?.filedDate?.toISOString(), "2026-09-14T00:00:00.000Z");
  assert.equal(cases[0]?.fullText, text);
  assert.equal(cases[0]?.url, pdf);
  assert.equal(requests.filter((url) => url.endsWith(".pdf")).length, 1);
  let writes = 0;
  await storeScotusCases(cases, async (input, options) => {
    assert.equal(input.type, "court_case");
    assert.deepEqual(input.data, cases[0]);
    assert.ok(options?.newItemLimiter);
    writes++;
    return { status: "written", id: "test-case" };
  });
  assert.equal(writes, 1);
});

void test("failed enrichment reaches supervisor retry handling; budget deferral is expected", async () => {
  const cases = [
    {
      caseNumber: "26A305",
      title: "Postal Service v. California",
      court: "Supreme Court of the United States",
      url: pdf,
    },
  ];
  await assert.rejects(
    storeScotusCases(cases, async () => ({
      status: "deferred",
      reason: "enrichment did not complete",
    })),
    /26A305 deferred: enrichment did not complete/,
  );
  await storeScotusCases(cases, async () => ({
    status: "deferred",
    reason: "run budget reached",
  }));
});

void test("both table layouts parse and revised PDFs replace the superseded link", () => {
  assert.equal(
    parseOpinionIndex(slip, `${base}/opinions/slipopinion/25`)[0]?.description,
    "Application for stay granted.",
  );
  const revised = orders.replace(
    "</a></td>",
    '</a><br>Revisions: <a href="/opinions/25pdf/26a305_new.pdf">9/15/26</a></td>',
  );
  assert.equal(
    parseOpinionIndex(revised, `${base}/opinions/relatingtoorders/25`)[0]
      ?.pdfUrls[0],
    `${base}/opinions/25pdf/26a305_new.pdf`,
  );
});

void test("separate opinions for the same ruling keep all source URLs and text", async () => {
  const separate = orders
    .replaceAll("26a305_4g15.pdf", "26a305_concurrence.pdf")
    .replace(
      '26a305_concurrence.pdf">Postal Service v. California</a></td><td>A',
      '26a305_dissent.pdf">Postal Service v. California</a></td><td>A',
    );
  const cases = await collectScotusCases(1, new Date("2026-09-15"), {
    fetch: async (url) =>
      new Response(
        url.endsWith(".pdf")
          ? url
          : url.includes("relatingtoorders/25")
            ? separate
            : empty,
      ),
    readPdf: async (bytes) => new TextDecoder().decode(bytes),
  });
  assert.match(cases[0]?.fullText ?? "", /26a305_concurrence.pdf/);
  assert.match(cases[0]?.fullText ?? "", /26a305_dissent.pdf/);
});

void test("bad dates and off-site PDF links cannot become court records", () => {
  assert.deepEqual(
    parseOpinionIndex(orders.replaceAll("9/14/26", "2/30/26"), base),
    [],
  );
  assert.deepEqual(
    parseOpinionIndex(
      orders.replaceAll(
        "/opinions/25pdf/26a305_4g15.pdf",
        "https://example.com/fake.pdf",
      ),
      base,
    ),
    [],
  );
});

void test("index failures and empty PDFs fail the job instead of reporting success", async () => {
  await assert.rejects(
    collectScotusCases(1, new Date("2026-09-15"), {
      fetch: async () => new Response("unavailable", { status: 503 }),
    }),
  );
  await assert.rejects(
    collectScotusCases(1, new Date("2026-09-15"), {
      fetch: async (url) =>
        new Response(url.includes("relatingtoorders/25") ? orders : empty),
      readPdf: async () => "",
    }),
    /Empty Supreme Court PDF/,
  );
});

void test("term rollover follows the first Monday in October, not January", () => {
  assert.equal(termYear(new Date("2026-01-01")), 2025);
  assert.equal(termYear(new Date("2026-10-04")), 2025);
  assert.equal(termYear(new Date("2026-10-05")), 2026);
});
