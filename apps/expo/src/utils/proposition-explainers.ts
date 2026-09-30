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
