import { sql } from "@acme/db";
import { db } from "@acme/db/client";

export interface BillRetentionInventory {
  jurisdiction: string;
  total: number;
  recent: number;
  unscored: number;
  saved: number;
  popular: number;
  controversial: number;
  talkedAbout: number;
  evict: number;
}

export interface BillRetentionPolicy {
  activeDays: number;
  topPerCategory: number;
}

export interface BillRetentionResult {
  jurisdiction: string;
  selected: number;
  bills: number;
  briefs: number;
  lenses: number;
  saves: number;
  interests: number;
  changeImages: number;
}

type RetentionExecutor = Pick<typeof db, "execute">;

function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

export function normalizeBillRetentionPolicy(
  policy: BillRetentionPolicy,
): BillRetentionPolicy {
  positiveInteger(policy.activeDays, "activeDays");
  positiveInteger(policy.topPerCategory, "topPerCategory");
  return policy;
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
  policyInput: BillRetentionPolicy,
  executor: RetentionExecutor = db,
): Promise<BillRetentionInventory[]> {
  const policy = normalizeBillRetentionPolicy(policyInput);

  const result = await executor.execute(sql`
    with save_counts as (
      select content_id, count(*)::integer as save_count
      from saved_article
      where content_type = 'bill'
      group by content_id
    ),
    base as (
      select
        bill.id,
        case
          when bill.source_website = 'openstates.org'
            then coalesce(substring(bill.bill_number from '^([A-Z]{2}) '), 'STATE')
          else 'US'
        end as jurisdiction,
        coalesce(
          bill.last_action_at,
          bill.source_updated_at,
          bill.introduced_date,
          bill.created_at
        ) as activity_at,
        coalesce(save_counts.save_count, 0) as save_count,
        case when bill_interest.content_hash = bill.content_hash
          then bill_interest.controversy_score end as controversy_score,
        case when bill_interest.content_hash = bill.content_hash
          then bill_interest.attention_score end as attention_score,
        coalesce(
          bill_interest.content_hash = bill.content_hash,
          false
        ) as has_current_score,
        bill.source_website <> 'openstates.org'
          and bill.bill_number in ('H.R. 3633') as editorial_pin
      from bill
      left join save_counts on save_counts.content_id = bill.id
      left join bill_interest on bill_interest.bill_id = bill.id
    ),
    ranked as (
      select
        *,
        row_number() over (
          order by save_count desc, activity_at desc nulls last, id desc
        ) as popularity_rank,
        row_number() over (
          order by controversy_score desc nulls last,
            activity_at desc nulls last,
            id desc
        ) as controversy_rank,
        row_number() over (
          order by attention_score desc nulls last,
            activity_at desc nulls last,
            id desc
        ) as attention_rank
      from base
    ),
    classified as (
      select
        *,
        activity_at >= now() - make_interval(days => ${policy.activeDays}) as is_recent,
        not has_current_score as is_unscored,
        save_count > 0 as is_saved,
        save_count > 0
          and popularity_rank <= ${policy.topPerCategory} as is_popular,
        controversy_score is not null
          and controversy_rank <= ${policy.topPerCategory} as is_controversial,
        attention_score is not null
          and attention_rank <= ${policy.topPerCategory} as is_talked_about
      from ranked
    )
    select
      jurisdiction,
      count(*)::integer as total,
      count(*) filter (where is_recent)::integer as recent,
      count(*) filter (where is_unscored)::integer as unscored,
      count(*) filter (where is_saved)::integer as saved,
      count(*) filter (where is_popular)::integer as popular,
      count(*) filter (where is_controversial)::integer as controversial,
      count(*) filter (where is_talked_about)::integer as talked_about,
      count(*) filter (
        where not (
          is_recent
          or is_unscored
          or is_saved
          or is_popular
          or is_controversial
          or is_talked_about
          or editorial_pin
        )
      )::integer as evict
    from classified
    group by jurisdiction
    order by jurisdiction
  `);

  return result.rows.map((row) => ({
    jurisdiction: String(row.jurisdiction),
    total: number(row.total),
    recent: number(row.recent),
    unscored: number(row.unscored),
    saved: number(row.saved),
    popular: number(row.popular),
    controversial: number(row.controversial),
    talkedAbout: number(row.talked_about),
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
  policyInput: BillRetentionPolicy,
  executor: RetentionExecutor = db,
): Promise<BillRetentionResult> {
  const jurisdiction = normalizeRetentionJurisdiction(jurisdictionInput);
  const policy = normalizeBillRetentionPolicy(policyInput);
  const statePattern = `${jurisdiction} %`;

  const result = await executor.execute(sql`
    with save_counts as (
      select content_id, count(*)::integer as save_count
      from saved_article
      where content_type = 'bill'
      group by content_id
    ),
    base as (
      select
        bill.id,
        case
          when bill.source_website = 'openstates.org'
            then coalesce(substring(bill.bill_number from '^([A-Z]{2}) '), 'STATE')
          else 'US'
        end as jurisdiction,
        coalesce(
          bill.last_action_at,
          bill.source_updated_at,
          bill.introduced_date,
          bill.created_at
        ) as activity_at,
        coalesce(save_counts.save_count, 0) as save_count,
        case when bill_interest.content_hash = bill.content_hash
          then bill_interest.controversy_score end as controversy_score,
        case when bill_interest.content_hash = bill.content_hash
          then bill_interest.attention_score end as attention_score,
        coalesce(
          bill_interest.content_hash = bill.content_hash,
          false
        ) as has_current_score,
        bill.source_website <> 'openstates.org'
          and bill.bill_number in ('H.R. 3633') as editorial_pin
      from bill
      left join save_counts on save_counts.content_id = bill.id
      left join bill_interest on bill_interest.bill_id = bill.id
    ),
    ranked as (
      select
        *,
        row_number() over (
          order by save_count desc, activity_at desc nulls last, id desc
        ) as popularity_rank,
        row_number() over (
          order by controversy_score desc nulls last,
            activity_at desc nulls last,
            id desc
        ) as controversy_rank,
        row_number() over (
          order by attention_score desc nulls last,
            activity_at desc nulls last,
            id desc
        ) as attention_rank
      from base
    ),
    classified as (
      select
        *,
        activity_at >= now() - make_interval(days => ${policy.activeDays}) as is_recent,
        not has_current_score as is_unscored,
        save_count > 0 as is_saved,
        save_count > 0
          and popularity_rank <= ${policy.topPerCategory} as is_popular,
        controversy_score is not null
          and controversy_rank <= ${policy.topPerCategory} as is_controversial,
        attention_score is not null
          and attention_rank <= ${policy.topPerCategory} as is_talked_about
      from ranked
    ),
    victims as materialized (
      select id
      from classified
      where jurisdiction = ${jurisdiction}
        and not (
          is_recent
          or is_unscored
          or is_saved
          or is_popular
          or is_controversial
          or is_talked_about
          or editorial_pin
        )
        and (
          ${jurisdiction} = 'US'
          or exists (
            select 1
            from bill
            where bill.id = classified.id
              and bill.bill_number like ${statePattern}
          )
        )
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
    deleted_interests as (
      delete from bill_interest
      using victims
      where bill_interest.bill_id = victims.id
      returning bill_interest.bill_id
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
      (select count(*)::integer from deleted_interests) as interests,
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
    interests: number(row.interests),
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
  policyInput: BillRetentionPolicy,
): Promise<BillRetentionResult[]> {
  const normalized = [
    ...new Set(jurisdictions.map(normalizeRetentionJurisdiction)),
  ];
  const policy = normalizeBillRetentionPolicy(policyInput);

  return db.transaction(async (tx) => {
    // A busy database should defer retention instead of waiting indefinitely
    // behind another writer. The next daily refresh will try again.
    await tx.execute(sql`set local lock_timeout = '5s'`);
    await tx.execute(sql`set local statement_timeout = '5min'`);

    const results: BillRetentionResult[] = [];
    for (const jurisdiction of normalized) {
      results.push(await pruneBillJurisdiction(jurisdiction, policy, tx));
    }
    return results;
  });
}
