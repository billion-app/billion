import assert from "node:assert/strict";
import test from "node:test";

import { collectRelationshipCorpus } from "./measure-relationship-capture.js";

const banner = '<div id="txtBnr">November 7, 2028</div>';
const index =
  banner +
  '<a href="/propositions/80/">80</a><a href="/propositions/81/">81</a>';
function detail(number: string) {
  return `${banner}<span id="propNum">${number}</span><div class="propName"><h2>Future measure ${number}</h2></div><div><h3 class="summaryHeadings">SUMMARY</h3></div><p>Official source summary.</p><h3 class="blackUnderline">WHAT YOUR VOTE MEANS</h3><div class="grdGrp"><p><span class="yesNoProCon">YES</span> Approves the measure.</p><p><span class="yesNoProCon">NO</span> Rejects the measure.</p></div>`;
}
void test("collector discovers the election list without an authored relationship and enforces measure budget before detail fetches", async () => {
  const reads: string[] = [];
  const dependencies = {
    fetchPage: async (url: string) => {
      reads.push(url);
      return url.endsWith("/propositions/")
        ? index
        : detail(url.includes("/80/") ? "80" : "81");
    },
    captureSources: async () => [],
  };
  await assert.rejects(
    collectRelationshipCorpus("2028-11-07", 1, dependencies),
    /budget/,
  );
  assert.equal(reads.length, 1);
  reads.length = 0;
  const corpus = await collectRelationshipCorpus("2028-11-07", 2, dependencies);
  assert.deepEqual(
    corpus.guide.measures.map((m) => m.number),
    ["80", "81"],
  );
  assert.equal(reads.length, 3);
  assert.equal(corpus.guide.complete, true);
  await assert.rejects(
    collectRelationshipCorpus("2030-11-05", 2, dependencies),
    /Election mismatch/,
  );
});
