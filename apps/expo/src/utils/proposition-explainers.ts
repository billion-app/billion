export function propositionDetailRoute(number: string) {
  return {
    pathname: "/proposition-detail" as const,
    params: { number },
  };
}

/** The guide sometimes returns a "no argument submitted" notice in the argument slot. */
export function submittedGuideArguments(
  argumentsFromGuide: readonly { text: string }[] | undefined,
): { text: string }[] {
  return (argumentsFromGuide ?? []).filter(
    (argument) => !/^NO ARGUMENT (?:FOR|AGAINST)\b/i.test(argument.text.trim()),
  );
}
