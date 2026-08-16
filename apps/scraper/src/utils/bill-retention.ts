export interface BillRetentionCandidate {
  id: string;
  billNumber: string;
  sourceWebsite: string;
  sourceUpdatedAt: Date | null;
  lastActionAt: Date | null;
  createdAt: Date;
}

export interface RankedBillRetentionCandidate extends BillRetentionCandidate {
  jurisdiction: string;
}

/**
 * State bill identity is embedded in the stable bill number as
 * `CA AB 2047 (2025-2026)`. Federal sources share the US bucket; malformed
 * Open States rows stay in their own bucket rather than crowding out Congress.
 */
export function retentionJurisdiction(candidate: BillRetentionCandidate) {
  if (candidate.sourceWebsite !== "openstates.org") return "US";
  return /^([A-Z]{2})\s/.exec(candidate.billNumber)?.[1] ?? "STATE";
}

function time(date: Date | null): number {
  return date?.getTime() ?? Number.NEGATIVE_INFINITY;
}

function newestFirst(
  left: BillRetentionCandidate,
  right: BillRetentionCandidate,
): number {
  return (
    time(right.sourceUpdatedAt) - time(left.sourceUpdatedAt) ||
    time(right.lastActionAt) - time(left.lastActionAt) ||
    right.createdAt.getTime() - left.createdAt.getTime() ||
    right.id.localeCompare(left.id)
  );
}

/** Select rows beyond the newest `keepPerJurisdiction` in each jurisdiction. */
export function selectBillsToEvict(
  candidates: readonly BillRetentionCandidate[],
  keepPerJurisdiction: number,
): RankedBillRetentionCandidate[] {
  if (!Number.isInteger(keepPerJurisdiction) || keepPerJurisdiction < 1) {
    throw new Error("keepPerJurisdiction must be a positive integer");
  }

  const groups = new Map<string, BillRetentionCandidate[]>();
  for (const candidate of candidates) {
    const jurisdiction = retentionJurisdiction(candidate);
    const group = groups.get(jurisdiction) ?? [];
    group.push(candidate);
    groups.set(jurisdiction, group);
  }

  return [...groups.entries()].flatMap(([jurisdiction, group]) =>
    group
      .sort(newestFirst)
      .slice(keepPerJurisdiction)
      .map((candidate) => ({ ...candidate, jurisdiction })),
  );
}
