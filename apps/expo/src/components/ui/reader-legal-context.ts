/** Source-projected terminal status takes precedence over a cached brief's tense. */
export function readerLegalContext(
  legalStatus: "proposed" | "enacted",
  sourceStatus?: string,
) {
  const terminal = sourceStatus?.trim().toLowerCase();
  const closed =
    terminal === "vetoed" || terminal === "failed" || terminal === "withdrawn";
  const enacted =
    !closed && (terminal === "enacted" || legalStatus === "enacted");
  return {
    enacted,
    closed,
    statusKey:
      terminal === "vetoed"
        ? ("readerUi.vetoedNotLaw" as const)
        : terminal === "failed"
          ? ("readerUi.failedNotLaw" as const)
          : terminal === "withdrawn"
            ? ("readerUi.withdrawnNotLaw" as const)
            : enacted
              ? ("readerUi.law" as const)
              : ("readerUi.proposedNotLaw" as const),
    scenarioKey: closed
      ? ("readerUi.whatProposed" as const)
      : enacted
        ? ("readerUi.underLaw" as const)
        : ("readerUi.ifPasses" as const),
  };
}
