/**
 * Backfill from an Open States bulk session-CSV export.
 *
 * Why this exists: the v3 API's free tier allows a few hundred requests a day,
 * and a California session holds thousands of bills that each need several
 * calls. Draining a session through the API alone takes weeks, which is how the
 * CourtListener scraper ended up shelved. The bulk export carries the same data
 * in one file and is refreshed regularly (CA 2025-2026 was current the day this
 * was written), so it does the backfill and the API only carries the delta.
 *
 * Why it takes a directory instead of downloading: the archives at
 * <https://open.pluralpolicy.com/data/session-csv/> are behind a site login,
 * not the API key — "Please log in to access download links". Automating the
 * fetch would mean storing account credentials in the scraper. Instead an
 * operator downloads and unzips once, and points `--bulk-dir` at the result.
 *
 * The CSVs are assembled back into the same `OpenStatesBill` shape the API
 * returns and handed to the same `normalizeBill`, so a backfilled bill and its
 * later incremental refresh are the same row rather than two.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  OpenStatesBill,
  OpenStatesBillAbstract,
  OpenStatesBillAction,
  OpenStatesBillSponsorship,
  OpenStatesBillVersion,
} from "@acme/api/clients/open-states";

/**
 * Split RFC 4180 CSV text into rows.
 *
 * Hand-rolled because the scraper has no CSV dependency and bill data needs the
 * quoting rules that a `split(",")` gets wrong: action descriptions contain
 * commas ("Chaptered by Secretary of State, Chapter 677"), bill titles contain
 * quotes, and abstracts contain embedded newlines. Getting any of those wrong
 * shifts every later column by one and stores garbage silently.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  // Strip a UTF-8 BOM; left in place it becomes part of the first header name.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (input[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Swallow the \n of a \r\n pair rather than emitting a blank row.
      if (char === "\r" && input[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // A file not ending in a newline still has one row left in hand.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Trailing newlines produce a [""] row that is not a record.
  return rows.filter((entry) => entry.length > 1 || entry[0] !== "");
}

export type CsvRecord = Record<string, string>;

/** Rows keyed by header name. Short rows read as empty, not as undefined. */
export function parseCsvRecords(text: string): CsvRecord[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const names = header.map((name) => name.trim());
  return rows.map((row) => {
    const record: CsvRecord = {};
    names.forEach((name, index) => {
      record[name] = row[index] ?? "";
    });
    return record;
  });
}

/**
 * Read a column that Open States may name either of two ways across export
 * vintages. Returns "" when absent — callers decide whether that is fatal.
 */
function column(record: CsvRecord, ...names: string[]): string {
  for (const name of names) {
    const value = record[name];
    if (value !== undefined && value !== "") return value.trim();
  }
  return "";
}

export class BulkExportShapeError extends Error {
  constructor(file: string, missing: string[], found: string[]) {
    super(
      `${file}: missing required column(s) ${missing.join(", ")}. ` +
        `Columns present: ${found.join(", ") || "(none)"}. ` +
        `The Open States CSV export format is documented as experimental and may have changed.`,
    );
    this.name = "BulkExportShapeError";
  }
}

/**
 * Files in an export are named `{STATE}_{session}_{table}.csv`. Matching on the
 * suffix rather than the full name keeps the reader working across states and
 * sessions without the caller having to spell out the prefix.
 */
function findFile(directory: string, table: string): string | undefined {
  const match = readdirSync(directory).find(
    (name) =>
      name.toLowerCase().endsWith(`${table}.csv`) ||
      name.toLowerCase() === `${table}.csv`,
  );
  return match ? join(directory, match) : undefined;
}

function readTable(directory: string, table: string): CsvRecord[] {
  const path = findFile(directory, table);
  if (!path) return [];
  return parseCsvRecords(readFileSync(path, "utf8"));
}

/** Group records by the bill they belong to. */
function groupByBill(records: CsvRecord[]): Map<string, CsvRecord[]> {
  const grouped = new Map<string, CsvRecord[]>();
  for (const record of records) {
    const billId = column(record, "bill_id", "bill");
    if (!billId) continue;
    const existing = grouped.get(billId);
    if (existing) existing.push(record);
    else grouped.set(billId, [record]);
  }
  return grouped;
}

function splitClassification(value: string): string[] {
  return value
    .split(/[,;|]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Rebuild `OpenStatesBill` objects from an unzipped export directory.
 *
 * Only `bills.csv` is required. Every other table is an optional enrichment:
 * an export missing sponsorships produces bills without a sponsor rather than
 * no bills at all, and the incremental API walk fills the gap on its next pass.
 * That is the right trade for a backfill — a bill in the database without a
 * sponsor is recoverable, a bill that never landed is not.
 */
export function readBulkBills(
  directory: string,
  options: { session?: string } = {},
): OpenStatesBill[] {
  const billRows = readTable(directory, "bills");
  if (billRows.length === 0) {
    throw new Error(
      `No bills.csv found in ${directory}. Expected an unzipped Open States session-CSV export (a directory containing e.g. CA_2025-2026_bills.csv).`,
    );
  }

  const firstRow = billRows[0]!;
  const missing = (["id", "identifier", "title"] as const).filter(
    (name) => !column(firstRow, name),
  );
  if (missing.length > 0) {
    throw new BulkExportShapeError(
      "bills.csv",
      [...missing],
      Object.keys(firstRow),
    );
  }

  const actionsByBill = groupByBill(readTable(directory, "bill_actions"));
  const abstractsByBill = groupByBill(readTable(directory, "bill_abstracts"));
  const sponsorsByBill = groupByBill(readTable(directory, "bill_sponsorships"));
  const sourcesByBill = groupByBill(readTable(directory, "bill_sources"));
  const versionsByBill = groupByBill(readTable(directory, "bill_versions"));

  // Version text lives one table further out, keyed by version rather than by
  // bill. Absent that table there are no text links, which is survivable.
  const linksByVersion = new Map<string, CsvRecord[]>();
  for (const record of readTable(directory, "bill_version_links")) {
    const versionId = column(record, "version_id", "bill_version_id");
    if (!versionId) continue;
    const existing = linksByVersion.get(versionId);
    if (existing) existing.push(record);
    else linksByVersion.set(versionId, [record]);
  }

  return billRows.map((row) => {
    const id = column(row, "id");

    const actions: OpenStatesBillAction[] = (actionsByBill.get(id) ?? []).map(
      (record) => ({
        date: column(record, "date"),
        description: column(record, "description"),
        classification: splitClassification(column(record, "classification")),
      }),
    );

    const abstracts: OpenStatesBillAbstract[] = (
      abstractsByBill.get(id) ?? []
    ).map((record) => ({
      abstract: column(record, "abstract"),
      note: column(record, "note"),
    }));

    const sponsorships: OpenStatesBillSponsorship[] = (
      sponsorsByBill.get(id) ?? []
    ).map((record) => {
      const name = column(record, "name");
      const party = column(record, "party", "primary_party");
      const district = column(record, "district");
      return {
        name,
        entity_type: column(record, "entity_type") || "person",
        classification: column(record, "classification") || "primary",
        primary: /^(true|1|t|yes)$/i.test(column(record, "primary")),
        // The export carries party/district as flat columns rather than a
        // nested person; reassemble just enough of one for `formatSponsor`.
        ...(party || district
          ? {
              person: {
                id: column(record, "person_id"),
                name,
                party,
                ...(district
                  ? {
                      current_role: {
                        title: "",
                        org_classification: "",
                        district,
                        division_id: "",
                      },
                    }
                  : {}),
              },
            }
          : {}),
      };
    });

    const versions: OpenStatesBillVersion[] = (
      versionsByBill.get(id) ?? []
    ).map((record) => ({
      note: column(record, "note"),
      date: column(record, "date"),
      links: (linksByVersion.get(column(record, "id")) ?? []).map((link) => ({
        url: column(link, "url"),
        media_type: column(link, "media_type") || undefined,
      })),
    }));

    const sources = (sourcesByBill.get(id) ?? [])
      .map((record) => ({ url: column(record, "url") }))
      .filter((source) => source.url);

    const organizationClassification = column(
      row,
      "organization_classification",
      "from_organization_classification",
      "chamber",
    );

    return {
      id,
      identifier: column(row, "identifier"),
      title: column(row, "title"),
      session:
        column(row, "session", "legislative_session") ||
        (options.session ?? ""),
      classification: splitClassification(column(row, "classification")),
      ...(organizationClassification
        ? {
            from_organization: {
              id: "",
              name: "",
              classification: organizationClassification,
            },
          }
        : {}),
      jurisdiction: {
        id: column(row, "jurisdiction_id", "jurisdiction"),
        name: column(row, "jurisdiction_name", "jurisdiction"),
        classification: "state",
      },
      abstracts,
      actions,
      sponsorships,
      versions,
      sources,
      created_at: column(row, "created_at", "first_action_date"),
      updated_at: column(row, "updated_at", "latest_action_date"),
      openstates_url: column(row, "openstates_url", "url"),
    } satisfies OpenStatesBill;
  });
}
