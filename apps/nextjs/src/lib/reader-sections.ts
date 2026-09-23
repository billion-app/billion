/**
 * The reader's sections, in reading order, for the "On this page" list.
 *
 * The same list names the headings' ids and the list's links, so the two
 * cannot drift apart. Blocks a record does not have are left out rather than
 * linking to nothing.
 */

/**
 * Window event asking the reader to show a section: `detail` is its id. The
 * reader switches back to the explainer first if the original text is open.
 */
export const GOTO_SECTION_EVENT = "billion:reader-goto-section";

export type SectionKey =
  | "short-version"
  | "what-would-change"
  | "who-it-lands-on"
  | "unknowns"
  | "explainer"
  | "how-people-make-the-case"
  | "keep-reading"
  | "court-ruling"
  | "court-questions"
  | "court-reasoning"
  | "court-effects"
  | "court-opinions"
  | "court-unknowns";

export interface ReaderSection {
  key: SectionKey;
  id: string;
  label: string;
}

/** The subset of a brief that decides which sections exist. */
interface BriefShape {
  unknowns: readonly unknown[];
  deepDive?: unknown;
  reading?: readonly unknown[];
}

interface CourtBriefShape {
  questions: readonly unknown[];
  reasoning: readonly unknown[];
  effects: readonly unknown[];
  opinions: readonly unknown[];
  unknowns: readonly unknown[];
}

export function sectionId(key: SectionKey): string {
  return `section-${key}`;
}

const LABELS: Record<SectionKey, string> = {
  "short-version": "The short version",
  "what-would-change": "What would change",
  "who-it-lands-on": "Who it lands on",
  unknowns: "What the text doesn't settle",
  explainer: "Plain explainer",
  "how-people-make-the-case": "How people make the case",
  "keep-reading": "Keep reading",
  "court-ruling": "What the court did",
  "court-questions": "Questions before the court",
  "court-reasoning": "How the court got there",
  "court-effects": "Who it lands on",
  "court-opinions": "Separate opinions",
  "court-unknowns": "What the ruling doesn't settle",
};

export function readerSections({
  brief,
  hasLens,
}: {
  brief: BriefShape | null;
  hasLens: boolean;
}): ReaderSection[] {
  const keys: SectionKey[] = brief
    ? [
        "short-version",
        "what-would-change",
        "who-it-lands-on",
        ...(brief.unknowns.length > 0 ? (["unknowns"] as const) : []),
        ...(hasLens ? (["how-people-make-the-case"] as const) : []),
        ...(brief.deepDive || (brief.reading?.length ?? 0) > 0
          ? (["keep-reading"] as const)
          : []),
      ]
    : // A lone explainer needs no table of contents.
      hasLens
      ? ["explainer", "how-people-make-the-case"]
      : [];
  return keys.map((key) => ({ key, id: sectionId(key), label: LABELS[key] }));
}

export function courtReaderSections({
  brief,
  hasLens,
}: {
  brief: CourtBriefShape;
  hasLens: boolean;
}): ReaderSection[] {
  const keys: SectionKey[] = [
    "short-version",
    "court-ruling",
    ...(brief.questions.length ? (["court-questions"] as const) : []),
    ...(brief.reasoning.length ? (["court-reasoning"] as const) : []),
    ...(brief.effects.length ? (["court-effects"] as const) : []),
    ...(brief.opinions.length ? (["court-opinions"] as const) : []),
    ...(brief.unknowns.length ? (["court-unknowns"] as const) : []),
    ...(hasLens ? (["how-people-make-the-case"] as const) : []),
  ];
  return keys.map((key) => ({ key, id: sectionId(key), label: LABELS[key] }));
}
