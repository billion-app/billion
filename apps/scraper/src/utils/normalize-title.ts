/**
 * Reduces a presidential document title to a form that survives the trip
 * between whitehouse.gov and the Federal Register.
 *
 * The two publish the same documents with cosmetically different titles —
 * curly versus straight apostrophes, different capitalisation of "To"/"the" in
 * trade proclamations, and stray double spaces. Stripping every non
 * alphanumeric character and lowercasing leaves a key that matched 9 of 9
 * overlapping documents when checked against the live feeds on 2026-08-07.
 *
 * This is deliberately NOT a unique identifier. Three distinct proclamations
 * published on 2026-07-23 (FR 2026-14991, -14992, -14997) share a title, a
 * signing date and a publication date; nothing in either source separates
 * them. Callers must therefore treat a match as "at least one document like
 * this exists", never as "this exact document exists" — see
 * `federalregister.ts` for how the skip is made count-aware so an ambiguous
 * title drops at most the documents already covered, rather than all of them.
 */
export function normalizeTitle(title: string): string {
  return title
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
