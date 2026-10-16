export function propositionDetailRoute(number: string) {
  return {
    pathname: "/proposition-detail" as const,
    params: { number },
  };
}

/** The vote label is already visible; retain the state's substantive wording. */
export function officialVoteMeaning(text: string, label: "YES" | "NO") {
  const preface = `A ${label} vote on this measure means:`;
  return text.startsWith(preface) ? text.slice(preface.length).trim() : text;
}

/** The guide sometimes returns a "no argument submitted" notice in the argument slot. */
export function submittedGuideArguments(
  argumentsFromGuide: readonly { text: string }[] | undefined,
): { text: string }[] {
  return (argumentsFromGuide ?? []).filter(
    (argument) => !/^NO ARGUMENT (?:FOR|AGAINST)\b/i.test(argument.text.trim()),
  );
}

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
