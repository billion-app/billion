import { sql } from "@acme/db";
import { db } from "@acme/db/client";

export interface BillRetentionInventory {
  jurisdiction: string;
  total: number;
  evict: number;
}

export interface BillRetentionResult {
  jurisdiction: string;
  selected: number;
  bills: number;
  briefs: number;
  lenses: number;
  saves: number;
  changeImages: number;
}

type RetentionExecutor = Pick<typeof db, "execute">;

/**
 * Source-controlled editorial pins stay inside the jurisdiction cap. They sort
 * ahead of the recency window, so adding one protected bill displaces one
 * ordinary federal slot instead of allowing storage to grow without a bound.
 */
const federalProtectionOrder = sql`
  case
    when source_website <> 'openstates.org'
      and bill_number in ('H.R. 3633')
      then 0
    else 1
  end
`;

function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

export function normalizeRetentionJurisdiction(value: string): string {
  const jurisdiction = value.trim().toUpperCase();
  if (jurisdiction !== "US" && !/^[A-Z]{2}$/.test(jurisdiction)) {
    throw new Error(`Invalid bill-retention jurisdiction: ${value}`);
  }
  return jurisdiction;
}

function number(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Invalid bill-retention count returned by Postgres: ${value}`,
    );
  }
  return parsed;
}

/**
 * Return only aggregate counts. Ranking happens in Postgres, so the scraper
 * never downloads bill rows merely to decide which ones are old.
 */
export async function billRetentionInventory(
  keepPerJurisdiction: number,
  executor: RetentionExecutor = db,
): Promise<BillRetentionInventory[]> {
  positiveInteger(keepPerJurisdiction, "keepPerJurisdiction");

  const result = await executor.execute(sql`
    with ranked as (
      select
        case
          when source_website = 'openstates.org'
            then coalesce(substring(bill_number from '^([A-Z]{2}) '), 'STATE')
          else 'US'
        end as jurisdiction,
        row_number() over (
          partition by case
            when source_website = 'openstates.org'
              then coalesce(substring(bill_number from '^([A-Z]{2}) '), 'STATE')
            else 'US'
          end
          order by ${federalProtectionOrder},
            source_updated_at desc nulls last,
            last_action_at desc nulls last,
            created_at desc,
            id desc
        ) as retention_rank
      from bill
    )
    select
      jurisdiction,
      count(*)::integer as total,
      count(*) filter (
        where retention_rank > ${keepPerJurisdiction}
      )::integer as evict
    from ranked
    group by jurisdiction
    order by jurisdiction
  `);

  return result.rows.map((row) => ({
    jurisdiction: String(row.jurisdiction),
    total: number(row.total),
    evict: number(row.evict),
  }));
}

/**
 * Delete one jurisdiction's overflow with a single server-side statement.
 * Only the aggregate result row crosses the database connection.
 *
 * The dependent content tables use polymorphic ids rather than foreign keys,
 * so they are deleted explicitly. Brief change images cascade from briefs.
 */
export async function pruneBillJurisdiction(
  jurisdictionInput: string,
  keepPerJurisdiction: number,
  executor: RetentionExecutor = db,
): Promise<BillRetentionResult> {
  const jurisdiction = normalizeRetentionJurisdiction(jurisdictionInput);
  positiveInteger(keepPerJurisdiction, "keepPerJurisdiction");
  const statePattern = `${jurisdiction} %`;

  const result = await executor.execute(sql`
    with victims as materialized (
      select id
      from bill
      where (
        ${jurisdiction} = 'US'
        and source_website <> 'openstates.org'
      ) or (
        ${jurisdiction} <> 'US'
        and source_website = 'openstates.org'
        and bill_number like ${statePattern}
      )
      order by ${federalProtectionOrder},
        source_updated_at desc nulls last,
        last_action_at desc nulls last,
        created_at desc,
        id desc
      offset ${keepPerJurisdiction}
    ),
    victim_briefs as materialized (
      select content_brief.id
      from content_brief
      inner join victims on victims.id = content_brief.content_id
      where content_brief.content_type = 'bill'
    ),
    deleted_lenses as (
      delete from content_lens
      using victims
      where content_lens.content_type = 'bill'
        and content_lens.content_id = victims.id
      returning content_lens.id
    ),
    deleted_saves as (
      delete from saved_article
      using victims
      where saved_article.content_type = 'bill'
        and saved_article.content_id = victims.id
      returning saved_article.id
    ),
    deleted_briefs as (
      delete from content_brief
      using victim_briefs
      where content_brief.id = victim_briefs.id
      returning content_brief.id
    ),
    deleted_bills as (
      delete from bill
      using victims
      where bill.id = victims.id
      returning bill.id
    )
    select
      (select count(*)::integer from victims) as selected,
      (select count(*)::integer from deleted_bills) as bills,
      (select count(*)::integer from deleted_briefs) as briefs,
      (select count(*)::integer from deleted_lenses) as lenses,
      (select count(*)::integer from deleted_saves) as saves,
      (
        select count(*)::integer
        from brief_change_image
        inner join victim_briefs
          on victim_briefs.id = brief_change_image.content_brief_id
      ) as change_images
  `);

  const row = result.rows[0];
  if (!row) throw new Error("Postgres returned no bill-retention result");

  const parsed: BillRetentionResult = {
    jurisdiction,
    selected: number(row.selected),
    bills: number(row.bills),
    briefs: number(row.briefs),
    lenses: number(row.lenses),
    saves: number(row.saves),
    changeImages: number(row.change_images),
  };
  if (parsed.bills !== parsed.selected) {
    throw new Error(
      `Selected ${parsed.selected} ${jurisdiction} bills but deleted ${parsed.bills}`,
    );
  }
  return parsed;
}

export async function enforceBillRetention(
  jurisdictions: readonly string[],
  keepPerJurisdiction: number,
): Promise<BillRetentionResult[]> {
  const normalized = [
    ...new Set(jurisdictions.map(normalizeRetentionJurisdiction)),
  ];
  positiveInteger(keepPerJurisdiction, "keepPerJurisdiction");

  return db.transaction(async (tx) => {
    // A busy database should defer retention instead of waiting indefinitely
    // behind another writer. The next daily refresh will try again.
    await tx.execute(sql`set local lock_timeout = '5s'`);
    await tx.execute(sql`set local statement_timeout = '5min'`);

    const results: BillRetentionResult[] = [];
    for (const jurisdiction of normalized) {
      results.push(
        await pruneBillJurisdiction(jurisdiction, keepPerJurisdiction, tx),
      );
    }
    return results;
  });
}
