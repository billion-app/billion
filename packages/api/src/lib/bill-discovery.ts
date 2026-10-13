import { sql } from "@acme/db";
import { Bill } from "@acme/db/schema";

// Match the explicit enactment evidence used by deriveBillLifecycle. Passage
// alone does not make a bill law. Keep this at query time, before pagination.
const ENACTMENT_TEXT =
  "\\m(became (a )?public law|became law|signed by (the )?president|signed by (the )?governor|chaptered into law|enacted into law)\\M";

export const billDiscoveryCondition = sql`not (
  exists (
    select 1 from jsonb_array_elements(coalesce(${Bill.actions}, '[]'::jsonb)) action
    where action->>'text' ~* ${ENACTMENT_TEXT}
      or coalesce(action->>'type', '') ~* '(^|,)[[:space:]]*(became-law|executive-signature)[[:space:]]*(,|$)'
      or coalesce(action->'classification', '[]'::jsonb) ?| array['became-law', 'executive-signature']
  )
  or coalesce(${Bill.status}, '') ~* ${ENACTMENT_TEXT}
) or coalesce((
  select min((action->>'date')::timestamptz)
  from jsonb_array_elements(coalesce(${Bill.actions}, '[]'::jsonb)) action
  where (
    action->>'text' ~* ${ENACTMENT_TEXT}
    or coalesce(action->>'type', '') ~* '(^|,)[[:space:]]*(became-law|executive-signature)[[:space:]]*(,|$)'
    or coalesce(action->'classification', '[]'::jsonb) ?| array['became-law', 'executive-signature']
  ) and nullif(action->>'date', '') is not null
), case when coalesce(${Bill.status}, '') ~* ${ENACTMENT_TEXT}
  then ${Bill.lastActionAt} at time zone 'UTC' end) >= now() - interval '7 days'`;
