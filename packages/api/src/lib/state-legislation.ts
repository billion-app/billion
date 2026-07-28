export interface StateBillAction {
  date: string;
  text: string;
  type?: string;
}

export interface StateBillVersion {
  hash: string;
  updatedAt: string;
  changes: string;
}

export function stateBillMetadata(
  actions: readonly StateBillAction[],
  versions: readonly StateBillVersion[],
) {
  const source = versions.at(-1);
  const committees = [
    ...new Set(
      actions.flatMap((action) => {
        if (action.type === "committee") {
          const name = action.text
            .replace(/^Committee hearing:\s*/i, "")
            .trim();
          return name ? [name] : [];
        }
        const match =
          /(?:Re-referred to Committee|Referred):\s*(.+?)(?:\([HS]\))?$/i.exec(
            action.text,
          );
        return match?.[1]?.trim() ? [match[1].trim()] : [];
      }),
    ),
  ];
  return {
    committees,
    effectiveDate: actions.find((action) => action.type === "effective_date")
      ?.date,
    sourceVersion: source?.hash,
    sourceUpdatedAt: source?.updatedAt,
    sourceCoverage: source?.changes,
  };
}
