import assert from "node:assert/strict";
import test from "node:test";

import {
  CA_GOV_EO_STRUCTURE_VERSION,
  classifyExecutiveOrderSubject,
  extractExecutiveOrderNumber,
  formatExecutiveOrderText,
  parseCaGovernorEoIndex,
  parseCaGovernorEoPost,
} from "./ca-governor-eos-parser.js";

test("parses unique EO post links and pagination", () => {
  const html = `<link rel="next" href="/category/executive-orders/page/2/">
    <main><article><a href="https://www.gov.ca.gov/2023/01/16/storm-order/">Order</a>
    <a href="https://www.gov.ca.gov/2023/01/16/storm-order/">Duplicate</a></article></main>`;
  assert.deepEqual(parseCaGovernorEoIndex(html), {
    postUrls: ["https://www.gov.ca.gov/2023/01/16/storm-order/"],
    nextPageUrl: "https://www.gov.ca.gov/category/executive-orders/page/2/",
  });
});

test("parses post metadata and signed PDF", () => {
  const html = `<meta property="og:title" content="Governor signs water order | Governor of California">
    <meta property="article:published_time" content="2023-01-16T12:00:00-08:00">
    <meta name="description" content="Protects water supplies.">
    <article><div class="entry-content"><p>The Governor signed an order.</p>
    <a href="/wp-content/uploads/order.pdf">Read the executive order</a></div></article>`;
  const parsed = parseCaGovernorEoPost(html, "https://www.gov.ca.gov/2023/01/16/water-order/");
  assert.ok(parsed);
  assert.equal(parsed.title, "Governor signs water order");
  assert.equal(parsed.pdfUrl, "https://www.gov.ca.gov/wp-content/uploads/order.pdf");
  assert.match(parsed.articleText ?? "", /Governor signed an order/);
});

test("extracts order metadata and formats a versioned record", () => {
  const legalText = "EXECUTIVE ORDER N-1-23\nWHEREAS severe drought affected California.";
  assert.equal(extractExecutiveOrderNumber(legalText), "N-1-23");
  assert.equal(classifyExecutiveOrderSubject("Water supply order", legalText), "Water and drought");
  const formatted = formatExecutiveOrderText({
    orderNumber: "N-1-23",
    subjectArea: "Water and drought",
    sourcePostUrl: "https://www.gov.ca.gov/example/",
    sourceDocumentUrl: "https://www.gov.ca.gov/order.pdf",
    body: legalText,
  });
  assert.match(formatted, new RegExp(`Source structure: ${CA_GOV_EO_STRUCTURE_VERSION}`));
  assert.match(formatted, /Executive order: N-1-23/);
});
