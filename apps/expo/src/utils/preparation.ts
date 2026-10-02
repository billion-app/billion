import type { Contest, Election } from "@acme/api";

export type Progress = "undecided" | "reviewed" | "skipped";
export interface Preparation {
  election: string;
  snapshot: string;
  title: string;
  electionName: string;
  electionDay: string;
  notes: string;
  progress: Progress;
  choice?: string;
}
export interface PreparationStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export const PREPARATION_KEY = "billion.private-preparation.v1";
export function electionKey(election: Election, provider: string) {
  return JSON.stringify([
    provider,
    election.id,
    election.electionDay,
    election.ocdDivisionId,
  ]);
}
// Exact identity until the provider supplies durable IDs. A changed roster,
// withdrawal, district or measure text requires fresh preparation, never rebinding.
export function contestSnapshot(contest: Contest) {
  return JSON.stringify([
    contest.type,
    contest.office,
    contest.district,
    contest.primaryParty,
    contest.referendumTitle,
    contest.referendumSubtitle,
    contest.referendumText,
    contest.numberVotingFor,
    contest.numberElected,
    contest.special,
    contest.ballotTitle,
    contest.electorateSpecifications,
    contest.level,
    contest.roles,
    contest.ballotPlacement,
    (contest.candidates ?? [])
      .map((c) => [c.name, c.party, c.ballotStatus, c.candidateUrl])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ]);
}
export function parsePreparation(raw: string | null): Preparation[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > 200)
    throw new Error("Invalid preparation");
  for (const item of value as unknown[]) {
    if (!item || typeof item !== "object")
      throw new Error("Invalid preparation");
    const p = item as Preparation;
    if (
      typeof p.election !== "string" ||
      typeof p.snapshot !== "string" ||
      typeof p.title !== "string" ||
      typeof p.electionName !== "string" ||
      typeof p.electionDay !== "string" ||
      typeof p.notes !== "string" ||
      p.notes.length > 1000 ||
      !["undecided", "reviewed", "skipped"].includes(p.progress) ||
      (p.choice !== undefined && typeof p.choice !== "string")
    )
      throw new Error("Invalid preparation");
  }
  return value as Preparation[];
}
export function createPreparationStore(storage: PreparationStorage) {
  let queue = Promise.resolve();
  const readDisk = async () =>
    parsePreparation(await storage.getItem(PREPARATION_KEY));
  function update(
    transform: (items: Preparation[]) => Preparation[],
    reset = false,
  ) {
    const result = queue.then(async () => {
      const next = transform(reset ? [] : await readDisk());
      parsePreparation(JSON.stringify(next));
      if (next.length > 200) throw new Error("Preparation is full");
      await storage.setItem(PREPARATION_KEY, JSON.stringify(next));
      return next;
    });
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  return {
    read: async () => {
      await queue;
      return readDisk();
    },
    save: (item: Preparation) =>
      update((items) => [
        ...items.filter(
          (p) => p.election !== item.election || p.snapshot !== item.snapshot,
        ),
        item,
      ]),
    remove: (item: Preparation) =>
      update((items) =>
        items.filter(
          (p) => p.election !== item.election || p.snapshot !== item.snapshot,
        ),
      ),
    clear: () => update(() => [], true),
  };
}
