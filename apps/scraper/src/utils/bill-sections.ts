import { createHash } from "node:crypto";
import { load } from "cheerio";

export const MAX_SECTION_BYTES = 500_000;

export interface ParsedBillSection {
  structuralPath: string;
  displayedNumber?: string;
  heading?: string;
  order: number;
  text: string;
  sectionHash: string;
  tokenCount: number;
  sourceStartOffset?: number;
  sourceEndOffset?: number;
  xmlId?: string;
  crossReferences: string[];
}

export interface BillSourceVersionInput {
  versionCode: string;
  versionType: string;
  officialDate?: Date;
  sourceUrl: string;
  rawXml: string;
  sourceHash: string;
}

function normalizedText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/§/g, " section ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function structuralPart(tag: string, number: string, fallback: number): string {
  const cleaned = number
    .replace(
      /^(sec(?:tion)?\.?|title|subtitle|division|part|subpart|chapter|subchapter)\s+/i,
      "",
    )
    .replace(/[.:]+$/g, "")
    .trim();
  return `${tag}-${slug(cleaned) || fallback}`;
}

function tokenCount(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

function sectionHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function splitAtWordBoundaries(text: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const word of text.split(/\s+/)) {
    const wordBytes = Buffer.byteLength(word, "utf8");
    const candidateBytes = currentBytes + (current ? 1 : 0) + wordBytes;
    if (current && candidateBytes > maxBytes) {
      chunks.push(current);
      current = word;
      currentBytes = wordBytes;
    } else {
      current = current ? `${current} ${word}` : word;
      currentBytes = candidateBytes;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Internal and statutory references useful for later provision linking. */
export function extractCrossReferences(text: string): string[] {
  const references = new Set<string>();
  const patterns = [
    /\bsections?\s+\d+[a-z0-9().-]*/gi,
    /\b\d+\s+U\.?\s*S\.?\s*C\.?\s*§?\s*\d+[a-z0-9().-]*/gi,
    /\bPublic Law \d+-\d+\b/gi,
    /\b(?:title|subtitle|chapter|part)\s+[IVXLCDM0-9A-Z-]+\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      references.add(normalizedText(match[0]!).replace(/[.,;:]+$/g, ""));
    }
  }
  return [...references].sort((a, b) => a.localeCompare(b));
}

function sourceOffsets(
  rawXml: string,
  xmlId: string | undefined,
  serialized: string,
): { sourceStartOffset?: number; sourceEndOffset?: number } {
  let start = rawXml.indexOf(serialized);
  if (start < 0 && xmlId) {
    const idAt = rawXml.search(
      new RegExp(
        `\\b(?:id|identifier)=(["'])${xmlId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`,
      ),
    );
    if (idAt >= 0) start = rawXml.lastIndexOf("<section", idAt);
  }
  if (start < 0) return {};

  const tags = /<\/?section\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  for (let match = tags.exec(rawXml); match; match = tags.exec(rawXml)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      return {
        sourceStartOffset: start,
        sourceEndOffset: match.index + match[0].length,
      };
    }
  }
  return { sourceStartOffset: start };
}

/**
 * Parse USLM-style formatted XML into stable, searchable units.
 *
 * Top-level <section> elements are ordinary units. Nested sections in quoted
 * amendments remain part of their containing section, preserving the enacted
 * language without duplicating it as if it were a provision of this bill.
 * Very large sections are grouped at subsection/paragraph boundaries.
 */
export function parseBillSections(rawXml: string): ParsedBillSection[] {
  const $ = load(rawXml, { xml: true });
  const parsed: ParsedBillSection[] = [];
  const usedPaths = new Map<string, number>();

  $("section").each((sectionIndex, element) => {
    if ($(element).parents("section").length > 0) return;

    const section = $(element);
    const displayedNumber = normalizedText(
      section.children("num").first().text(),
    );
    const heading = normalizedText(section.children("heading").first().text());
    const ancestors = section
      .parents("title, subtitle, division, part, subpart, chapter, subchapter")
      .toArray()
      .reverse()
      .map((ancestor, index) => {
        const node = $(ancestor);
        const tag = ancestor.tagName.toLowerCase();
        return structuralPart(
          tag,
          normalizedText(node.children("num").first().text()),
          index + 1,
        );
      });
    const basePart = structuralPart(
      "section",
      displayedNumber,
      sectionIndex + 1,
    );
    const basePath = [...ancestors, basePart].join("/");
    const occurrence = (usedPaths.get(basePath) ?? 0) + 1;
    usedPaths.set(basePath, occurrence);
    const uniqueBasePath =
      occurrence === 1 ? basePath : `${basePath}-${occurrence}`;

    const wholeText = normalizedText(section.text());
    const xmlId = section.attr("id") ?? section.attr("identifier");
    const serialized = $.xml(element);
    const offsets = sourceOffsets(rawXml, xmlId, serialized);

    const boundaryChildren = section.children(
      "subsection, paragraph, subparagraph, clause",
    );
    const chunks: string[] = [];
    if (
      Buffer.byteLength(wholeText, "utf8") > MAX_SECTION_BYTES &&
      boundaryChildren.length > 1
    ) {
      const prefix = normalizedText(`${displayedNumber} ${heading}`);
      let current = prefix;
      boundaryChildren.each((_, child) => {
        const childText = normalizedText($(child).text());
        const childChunks = splitAtWordBoundaries(
          childText,
          MAX_SECTION_BYTES - Buffer.byteLength(prefix, "utf8") - 1,
        );
        for (const childChunk of childChunks) {
          if (
            current !== prefix &&
            Buffer.byteLength(`${current} ${childChunk}`, "utf8") >
              MAX_SECTION_BYTES
          ) {
            chunks.push(current);
            current = prefix;
          }
          current = normalizedText(`${current} ${childChunk}`);
        }
      });
      if (current !== prefix) chunks.push(current);
    } else {
      chunks.push(wholeText);
    }

    chunks.forEach((text, chunkIndex) => {
      if (!text) return;
      const structuralPath =
        chunks.length === 1
          ? uniqueBasePath
          : `${uniqueBasePath}/part-${String(chunkIndex + 1).padStart(3, "0")}`;
      parsed.push({
        structuralPath,
        displayedNumber: displayedNumber || undefined,
        heading: heading || undefined,
        order: parsed.length,
        text,
        sectionHash: sectionHash(text),
        tokenCount: tokenCount(text),
        ...offsets,
        xmlId,
        crossReferences: extractCrossReferences(text),
      });
    });
  });

  return parsed;
}
