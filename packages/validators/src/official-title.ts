const MEASURE_KIND =
  /\.\s*((?:LEGISLATIVE|INITIATIVE|REFERENDUM)\b[A-Z ,]*?)\.?\s*$/;

/**
 * Splits an official guide title into what the measure does and its legal
 * kind ("Legislative statute"). Both halves stay the state's own words.
 */
export function splitOfficialTitle(title: string): {
  subject: string;
  kind?: string;
} {
  const match = MEASURE_KIND.exec(title);
  if (!match?.[1]) return { subject: title.trim() };
  const kind = match[1].trim().toLowerCase();
  return {
    subject: `${title.slice(0, match.index).trim()}.`,
    kind: kind.charAt(0).toUpperCase() + kind.slice(1),
  };
}

/** Letters and digits only, so casing, `**` marks and punctuation are ignored. */
const wording = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * True when a reformatted title keeps the official words exactly: only
 * capitalization, emphasis marks and punctuation may differ.
 */
export function keepsOfficialWording(formatted: string, official: string) {
  return wording(formatted) === wording(official);
}
