import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "cheerio";

import { propositionGuideHash } from "@acme/api/lib/measure-relationships";
import { measureRelationshipSchema } from "@acme/validators";

import {
  guideElectionDate,
  parseGuideMeasure,
} from "./ca-official-guide-parser.js";
import { fetchGuidePage } from "./ca-official-guide-source.js";
import { fetchRelationshipDocument } from "./measure-relationship-source.js";

/** Explicit read-only curation adapter. Exactly two measures; no DB, generation or approval. */
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: measure-relationship-preview.ts draft.json output.json",
  );
const inputValue = JSON.parse(await readFile(input, "utf8"));
const draft = measureRelationshipSchema.parse(inputValue.draft ?? inputValue);
if (draft.review.state !== "pending")
  throw new Error(
    "Capture produces a new pending revision; it cannot preserve approval",
  );
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const guideMeasures = [];
for (const identity of draft.measures) {
  const html = await fetchGuidePage(identity.url);
  if (guideElectionDate(html) !== draft.electionDate)
    throw new Error("Election mismatch");
  const measure = parseGuideMeasure(html, identity.url, draft.electionDate);
  if (
    !measure ||
    measure.number !== identity.number ||
    measure.title !== identity.title
  )
    throw new Error("Measure identity mismatch");
  identity.guideHash = propositionGuideHash(draft.electionDate, measure);
  guideMeasures.push(measure);
}
// Capture exact linked PDFs independently of explanation; keep full extraction.
for (const source of draft.sources) {
  if (source.role === "official-analysis") {
    const identity = draft.measures.find((m) => m.number === source.number);
    if (!identity || source.url !== `${identity.url}analysis.htm`)
      throw new Error("Analysis identity mismatch");
    const html = await fetchGuidePage(source.url);
    if (guideElectionDate(html) !== draft.electionDate)
      throw new Error("Analysis election mismatch");
    const $ = load(html);
    if (
      $("#propNum").text().trim() !== source.number ||
      $(".propName h2").text().replace(/\s+/g, " ").trim() !== identity.title
    )
      throw new Error("Analysis measure identity mismatch");
    source.snapshot = $("#mainCont").text().replace(/\s+/g, " ").trim();
    // Interaction warnings can be image alt text in the official analysis.
    if (source.snapshot.length < 250)
      throw new Error("Missing official analysis text");
    source.snapshot +=
      " " +
      $("#mainCont img")
        .map((_, image) => $(image).attr("alt") ?? "")
        .get()
        .join(" ");
    source.retrievedAt = new Date().toISOString();
    source.hash = sha(source.snapshot);
    source.documentHash = sha(html);
  } else {
    const measure = guideMeasures.find((m) => m.number === source.number);
    if (!measure || measure.fullTextUrl !== source.url)
      throw new Error(
        "Legal text must match the linked PDF and proposition heading",
      );
    const bytes = await fetchRelationshipDocument(source.url);
    const directory = await mkdtemp(join(tmpdir(), "billion-relationship-"));
    try {
      const pdf = join(directory, "source.pdf");
      await writeFile(pdf, bytes);
      source.snapshot = execFileSync("pdftotext", ["-layout", pdf, "-"], {
        maxBuffer: 200000,
      }).toString("utf8");
      if (!source.snapshot.includes(`PROPOSITION ${source.number}`))
        throw new Error("Downloaded legal text heading mismatch");
      source.hash = sha(source.snapshot);
      source.documentHash = createHash("sha256").update(bytes).digest("hex");
      source.retrievedAt = new Date().toISOString();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    if (source.hash !== sha(source.snapshot))
      throw new Error("Legal text hash mismatch");
  }
}
await writeFile(
  output,
  JSON.stringify(
    {
      draft,
      guideMeasures,
      relationshipSources: draft.sources.map((s) => ({
        url: s.url,
        hash: s.documentHash,
      })),
    },
    null,
    2,
  ) + "\n",
);
