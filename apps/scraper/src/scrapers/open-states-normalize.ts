/**
 * Normalization from Open States v3 shapes into Billion's `Bill` contract.
 *
 * Everything here is pure so the API walk and the bulk-CSV backfill can share
 * one definition of what a state bill looks like. The two paths carry different
 * source shapes but must produce byte-identical rows — otherwise a backfilled
 * bill and its later incremental refresh become two rows, or worse, thrash the
 * content hash and regenerate enrichment on every run.
 */

import type {
  OpenStatesBill,
  OpenStatesBillAbstract,
  OpenStatesBillAction,
  OpenStatesBillSponsorship,
  OpenStatesBillVersion,
} from "@acme/api/clients/open-states";

/**
 * Written into `Bill.sourceWebsite` for every state bill regardless of which
 * state it came from.
 *
 * The uniqueness constraint on `Bill` is (billNumber, sourceWebsite), so this
 * value is half of every state bill's identity: changing it orphans every row
 * already stored. The state and session live in `billNumber` instead — see
 * `buildBillNumber`.
 */
export const OPEN_STATES_SOURCE = "openstates.org";

interface ChamberNames {
  upper: string;
  lower: string;
}

/**
 * What each state calls its chambers. `upper`/`lower` is the only chamber
 * vocabulary Open States exposes, and "lower house" is not a name any reader
 * recognises — California's is the Assembly, and SB 243 sitting under "House"
 * would be simply wrong.
 *
 * Unlisted states fall back to Senate/House, which is correct for most of them.
 * Add a state here when adding it to the scraper's jurisdiction list, rather
 * than pre-registering all fifty from memory.
 */
const CHAMBER_NAMES: Record<string, ChamberNames> = {
  ca: { upper: "Senate", lower: "Assembly" },
};

const DEFAULT_CHAMBER_NAMES: ChamberNames = { upper: "Senate", lower: "House" };

export function chamberNamesFor(stateCode: string): ChamberNames {
  return CHAMBER_NAMES[stateCode.toLowerCase()] ?? DEFAULT_CHAMBER_NAMES;
}

/**
 * Split a bill identifier into its alphabetic prefix and numeric part, so
 * spacing differences between sources cannot produce two identities for one
 * bill. "SB243", "SB 243" and "sb  243" are all the same bill, and the CSV
 * bulk export and the API do not always agree on the spacing.
 *
 * Returns undefined for anything that is not <letters><digits><optional
 * suffix>, which is deliberate: an identifier we cannot decompose is one we
 * cannot promise a stable key for, and the caller refuses the bill rather than
 * inventing one.
 */
export function parseIdentifier(
  identifier: string,
): { prefix: string; number: string } | undefined {
  const match = /^\s*([A-Za-z]+)[\s.]*(\d+[A-Za-z]?)\s*$/.exec(identifier);
  if (!match) return undefined;
  return { prefix: match[1]!.toUpperCase(), number: match[2]!.toUpperCase() };
}

/** "SB243" / "sb  243" → "SB 243". Undefined when it cannot be decomposed. */
export function normalizeIdentifier(identifier: string): string | undefined {
  const parsed = parseIdentifier(identifier);
  return parsed && `${parsed.prefix} ${parsed.number}`;
}

/**
 * Human-readable session label. Open States session identifiers for
 * two-year states are eight digits ("20252026"); everything else (special
 * sessions, single-year states) is passed through untouched rather than
 * guessed at.
 */
export function formatSessionLabel(session: string): string {
  const match = /^(\d{4})(\d{4})$/.exec(session.trim());
  if (!match) return session.trim();
  return `${match[1]}-${match[2]}`;
}

/**
 * The stored `Bill.billNumber`, and with `OPEN_STATES_SOURCE` the row's whole
 * identity.
 *
 * Three things have to be in it. The **state**, because SB 243 exists in most
 * states. The **session**, because SB 243 exists in every California session
 * and they are unrelated bills. And a shape that cannot collide with
 * congress.gov's ("H.R. 1234") — the state prefix guarantees that even before
 * `sourceWebsite` does.
 *
 * Stability matters more than prettiness here: every character of this string
 * is load-bearing, and changing the format silently duplicates every bill.
 */
export function buildBillNumber(args: {
  stateCode: string;
  identifier: string;
  session: string;
}): string | undefined {
  const identifier = normalizeIdentifier(args.identifier);
  if (!identifier) return undefined;
  const state = args.stateCode.trim().toUpperCase();
  if (!state) return undefined;
  return `${state} ${identifier} (${formatSessionLabel(args.session)})`;
}

/**
 * Recover {stateCode, identifier} from a stored billNumber. The inverse of
 * `buildBillNumber` for the session-free parts — the session label is not
 * round-tripped because its source form is not recoverable from the label.
 */
export function parseBillNumber(
  billNumber: string,
): { stateCode: string; identifier: string; sessionLabel: string } | undefined {
  const match = /^([A-Z]{2})\s+([A-Z]+\s\d+[A-Z]?)\s+\((.+)\)$/.exec(
    billNumber.trim(),
  );
  if (!match) return undefined;
  return {
    stateCode: match[1]!,
    identifier: match[2]!,
    sessionLabel: match[3]!,
  };
}

/**
 * Chamber name for display. Prefers the originating organization's
 * classification, then the identifier prefix — "S…" is an upper-chamber bill
 * and "A…"/"H…" a lower-chamber one in every state that uses those letters.
 */
export function mapChamber(
  args: { stateCode: string; identifier: string },
  classification?: string,
): string | undefined {
  const names = chamberNamesFor(args.stateCode);
  const normalized = classification?.toLowerCase();
  if (normalized === "upper") return names.upper;
  if (normalized === "lower") return names.lower;
  if (normalized === "legislature") return "Legislature";

  const prefix = parseIdentifier(args.identifier)?.prefix;
  if (!prefix) return undefined;
  if (prefix.startsWith("S")) return names.upper;
  if (prefix.startsWith("A") || prefix.startsWith("H")) return names.lower;
  return undefined;
}

/**
 * Newest action, by date.
 *
 * Open States documents actions as chronological, but this does not trust that:
 * `status` is derived from whichever action comes back last, and reading a
 * chaptered bill as "Introduced" because one feed arrived reversed is the kind
 * of wrong that looks right. Undated actions sort first — an action with no
 * date is not evidence of being the latest — and ties keep source order, so a
 * same-day introduction/referral pair still reads as the referral.
 */
export function latestAction(
  actions: readonly OpenStatesBillAction[] | undefined,
): OpenStatesBillAction | undefined {
  if (!actions?.length) return undefined;
  return actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.action.date ?? "");
      const rightTime = Date.parse(right.action.date ?? "");
      const leftValid = !Number.isNaN(leftTime);
      const rightValid = !Number.isNaN(rightTime);
      if (leftValid && rightValid && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      if (leftValid !== rightValid) return leftValid ? 1 : -1;
      return left.index - right.index;
    })
    .at(-1)?.action;
}

/**
 * Canonical labels for the action classifications that describe a bill's fate.
 * Ordered most-final first: an action carrying both `passage` and
 * `executive-signature` is a signing, not a passage.
 */
const STATUS_BY_CLASSIFICATION: readonly [string, string][] = [
  ["became-law", "Chaptered into law"],
  ["executive-signature", "Signed by the governor"],
  ["executive-veto", "Vetoed by the governor"],
  ["veto-override-passage", "Veto overridden"],
  ["executive-veto-line-item", "Line-item vetoed by the governor"],
  ["withdrawal", "Withdrawn"],
  ["failure", "Failed"],
  ["passage", "Passed"],
  ["committee-passage", "Passed committee"],
  ["referral-committee", "Referred to committee"],
  ["introduction", "Introduced"],
];

/**
 * A short status for the bill's newest action.
 *
 * Prefers a canonical label from the action's OCD classification and falls back
 * to the action's own description, which is always meaningful even when the
 * classification list is empty (Open States leaves it empty fairly often).
 * The description is stored whole — `Bill.status` is `text`, and slicing it is
 * what once made long-action bills fail to insert entirely.
 */
export function mapStatus(
  actions: readonly OpenStatesBillAction[] | undefined,
): string {
  const action = latestAction(actions);
  if (!action) return "Unknown";

  const classifications = new Set(
    (action.classification ?? []).map((value) => value.toLowerCase()),
  );
  for (const [classification, label] of STATUS_BY_CLASSIFICATION) {
    if (classifications.has(classification)) return label;
  }
  return action.description?.trim() || "Unknown";
}

/** Actions in the shape `Bill.actions` stores, oldest first. */
export function normalizeActions(
  actions: readonly OpenStatesBillAction[] | undefined,
): { date: string; text: string; type?: string }[] {
  if (!actions?.length) return [];
  return actions
    .filter((action) => action.description?.trim())
    .map((action) => ({
      date: action.date,
      text: action.description.trim(),
      // `type` mirrors congress.gov's coarse action type. Open States has no
      // single equivalent, so the classification list is joined rather than
      // dropped — the brief generator reads it as free text either way.
      ...(action.classification?.length
        ? { type: action.classification.join(", ") }
        : {}),
    }));
}

const PARTY_ABBREVIATIONS: Record<string, string> = {
  democratic: "D",
  democrat: "D",
  republican: "R",
  independent: "I",
  libertarian: "L",
  green: "G",
  nonpartisan: "NP",
};

function abbreviateParty(party: string): string {
  return PARTY_ABBREVIATIONS[party.trim().toLowerCase()] ?? party.trim();
}

/**
 * Primary sponsor as "Name (D-14)", matching the federal scraper's shape so
 * both kinds of bill read the same in the app. Falls back through
 * co-sponsorships and to the bare name when Open States has not resolved the
 * sponsorship to a person — a name with no party is still worth showing.
 */
export function formatSponsor(
  sponsorships: readonly OpenStatesBillSponsorship[] | undefined,
): string | undefined {
  if (!sponsorships?.length) return undefined;
  const sponsorship =
    sponsorships.find((candidate) => candidate.primary) ?? sponsorships[0]!;

  const name = sponsorship.person?.name ?? sponsorship.name;
  if (!name?.trim()) return undefined;

  const party = sponsorship.person?.party;
  const district = sponsorship.person?.current_role?.district;
  const qualifier = [party && abbreviateParty(party), district]
    .filter(Boolean)
    .join("-");

  const formatted = qualifier ? `${name.trim()} (${qualifier})` : name.trim();
  // `Bill.sponsor` is varchar(256); stay inside it the way congress.ts does.
  return formatted.slice(0, 250);
}

/**
 * The abstract to keep as source material for the brief generator.
 *
 * Longest wins. States file several — California publishes both a one-line
 * digest and a full legislative counsel's digest under different notes — and
 * the longer one is the one with enough substance to summarise from.
 */
export function pickAbstract(
  abstracts: readonly OpenStatesBillAbstract[] | undefined,
): string | undefined {
  if (!abstracts?.length) return undefined;
  const best = abstracts
    .map((entry) => entry.abstract?.trim())
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length)[0];
  return best || undefined;
}

const TEXT_MEDIA_PREFERENCE = ["text/html", "text/plain", "application/pdf"];

/**
 * The link to fetch a bill's operative text from.
 *
 * Newest version first, preferring HTML/plain text before PDF. PDF support is
 * required for states such as North Carolina whose bulk exports publish no
 * abstracts or HTML versions. Undated versions sort last, for the same reason
 * the federal scraper does it — an undated version is not evidence of being
 * current, and storing an introduced draft as though it were the chaptered
 * text is the exact failure that made the federal briefs wrong for months.
 */
export function pickVersionLink(
  versions: readonly OpenStatesBillVersion[] | undefined,
): { url: string; mediaType?: string; note?: string } | undefined {
  if (!versions?.length) return undefined;

  const ordered = [...versions].sort((left, right) => {
    const leftTime = Date.parse(left.date ?? "");
    const rightTime = Date.parse(right.date ?? "");
    const leftValid = !Number.isNaN(leftTime);
    const rightValid = !Number.isNaN(rightTime);
    if (leftValid && rightValid) return rightTime - leftTime;
    if (leftValid) return -1;
    if (rightValid) return 1;
    return 0;
  });

  for (const version of ordered) {
    for (const mediaType of TEXT_MEDIA_PREFERENCE) {
      const link = version.links?.find(
        (candidate) => candidate.media_type?.toLowerCase() === mediaType,
      );
      if (link?.url) {
        return { url: link.url, mediaType, note: version.note };
      }
    }
  }
  return undefined;
}

/**
 * The canonical link for a reader to follow.
 *
 * An official state URL beats the Open States mirror: it is what the bill's own
 * legislature publishes, it is what a reader can cite, and it is what the issue
 * report linked. Open States' own page is the fallback, and it always exists.
 */
export function pickSourceUrl(bill: {
  sources?: { url: string; note?: string }[];
  openstates_url?: string;
}): string | undefined {
  const official = bill.sources?.find((source) => {
    if (!source.url) return false;
    try {
      return new URL(source.url).hostname.toLowerCase().endsWith(".gov");
    } catch {
      return false;
    }
  });
  return official?.url ?? bill.openstates_url ?? undefined;
}

/** A bill normalized far enough to hand to `upsertContent`, minus full text. */
export interface NormalizedStateBill {
  billNumber: string;
  title: string;
  sponsor?: string;
  status: string;
  introducedDate?: Date;
  chamber?: string;
  summary?: string;
  actions: { date: string; text: string; type?: string }[];
  url: string;
  sourceWebsite: string;
  sourceUpdatedAt?: Date;
  /** Where to fetch the operative bill text, when a text format exists. */
  textLink?: { url: string; mediaType?: string; note?: string };
  /** Carried for logging and the leginfo link, not persisted directly. */
  stateCode: string;
  session: string;
}

export class UnnormalizableBillError extends Error {
  constructor(
    readonly identifier: string,
    reason: string,
  ) {
    super(`${identifier}: ${reason}`);
    this.name = "UnnormalizableBillError";
  }
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value?.trim()) return undefined;
  // Open States dates are sometimes bare "YYYY-MM-DD"; Date.parse reads those
  // as UTC midnight, which is what we want for a legislative calendar date.
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time);
}

/**
 * Full normalization of an Open States bill. Throws `UnnormalizableBillError`
 * rather than returning a partial record: a bill with no stable identifier or
 * no title cannot be stored without either colliding with another row or
 * showing a reader a blank card.
 */
export function normalizeBill(
  bill: OpenStatesBill,
  options: { stateCode: string },
): NormalizedStateBill {
  const billNumber = buildBillNumber({
    stateCode: options.stateCode,
    identifier: bill.identifier,
    session: bill.session,
  });
  if (!billNumber) {
    throw new UnnormalizableBillError(
      bill.identifier || bill.id,
      "identifier does not decompose into a stable bill number",
    );
  }

  const title = bill.title?.trim();
  if (!title) {
    throw new UnnormalizableBillError(bill.identifier, "no title published");
  }

  const url = pickSourceUrl(bill);
  if (!url) {
    throw new UnnormalizableBillError(bill.identifier, "no source URL");
  }

  const introducedDate =
    parseDate(
      latestAction(
        bill.actions?.filter((action) =>
          action.classification?.includes("introduction"),
        ),
      )?.date,
    ) ?? parseDate(bill.created_at);

  return {
    billNumber,
    title,
    sponsor: formatSponsor(bill.sponsorships),
    status: mapStatus(bill.actions),
    introducedDate,
    chamber: mapChamber(
      { stateCode: options.stateCode, identifier: bill.identifier },
      bill.from_organization?.classification,
    ),
    summary: pickAbstract(bill.abstracts),
    actions: normalizeActions(bill.actions),
    url,
    sourceWebsite: OPEN_STATES_SOURCE,
    sourceUpdatedAt: parseDate(bill.updated_at),
    textLink: pickVersionLink(bill.versions),
    stateCode: options.stateCode.toUpperCase(),
    session: bill.session,
  };
}
