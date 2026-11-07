# What it costs to run Billion

Updated October 22, 2026. All amounts are USD. Published prices were checked on this date; taxes, discounts, credits and shared-account allocations can change the amount actually paid.

**October 22 status:** sampled artwork service was restored by 2:13 PM Pacific. All 11 live HTTP checks passed, including the three image URLs previously blocked by the quota. The owner chose a paid Supabase upgrade instead of an emergency Big Mac migration; the actual plan, renewal date and invoice remain unverified. A one-time reminder is set for November 4 at 9 AM Pacific to reassess before renewal.

**Billion's actual monthly spend is not yet verified.** This document consolidates the running infrastructure, earlier cost research, current public prices and the missing billing evidence. It is a budget model, not an invoice reconciliation.

A useful planning subtotal is **$53.25/month ($639/year)** for one Supabase Pro project, one Vercel Pro deploying seat and an Apple Developer membership spread over twelve months. Adding Expo Starter makes that **$72.25/month ($867/year)**. These are hypothetical plan combinations, **not Billion's confirmed plans or its all-in cost**: both exclude AI subscriptions, API usage, the Mac's electricity, domain renewal, additional seats, overages and labor.

## 1. What Billion currently runs

The [architecture tour](architecture.md) describes a Next.js website/API on Vercel, Supabase Postgres and image storage, an Expo mobile app, and background ingestion on `big-mac`. Content is generated and cached before readers open it; traffic does not necessarily cause a new AI generation for each reader.

A read-only host inspection on October 22 found both `billion-supervisor` and `billion-translations` running. The host's saved scraper configuration selects:

| Work                           | Observed configuration                                                              | Cost implication                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Text and structured generation | Host Responses proxy, `gpt-6-luna`, primary priority                                | Allocate the backing subscription and any extra credits actually purchased. Its price and account allocation were not available.     |
| Header artwork                 | Subscription-backed `gpt-image-2`                                                   | Count the backing subscription once if it also supplies text. Quota use is not automatically an API-dollar charge.                   |
| Web research                   | Local SearXNG                                                                       | Local compute and electricity; no per-search vendor tariff was established.                                                          |
| Outage alternatives            | Local LLM, DeepSeek credential, local FLUX; Tavily and BFL credentials also present | A configured credential is not proof of usage or payment. The scheduled artwork path falls back to local generation, not hosted BFL. |
| OpenRouter and Gemini vision   | No OpenRouter or Gemini API key in the inspected host file                          | Do not assume these are current scraper expenses. Other deployments/accounts were not inspected.                                     |

This is a saved-configuration and container-status snapshot, not a month-long provider-usage export or proof of every request's route. The [host guide](../deploy/big-mac/README.md), [active scraper registry](../apps/scraper/src/scrapers.ts) and [job configuration](../apps/supervisor/src/config.ts) explain the supported paths. The host file inspected was `~/.config/billion/scraper.env`; only selected non-secret settings and credential-presence flags were read into the report.

The separate [self-hosted Supabase trial](../deploy/big-mac/supabase-trial/README.md) is a private production copy. Its documentation says production still uses the existing database and Vercel deployment. **Do not book hosting savings from that trial as an accomplished migration.**

## 2. Recurring cost inventory

“Unknown” means the amount was not established; it does not mean zero. Public tiers below are comparison points, not account-plan confirmations.

| Service or resource                   | What it pays for                                                                   | Published benchmark or budgeting basis                                                                                                                                                                                                                                                                                    | Billion's actual amount                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Supabase                              | Postgres, stored artwork and outgoing data                                         | Free: $0 with 5 GB egress and a separate 5 GB cached-egress allowance. Pro starts at $25/month, with one Micro project's compute covered by the included compute credit; 250 GB egress and 250 GB cached egress included. Above those quotas: $0.09/GB and $0.03/GB respectively. [Pricing](https://supabase.com/pricing) | Unknown; recent quota incident described below.                   |
| Vercel                                | Website, tRPC API and web deployment                                               | Pro: $20/month including one deploying seat and $20 usage credit; additional deploying seats $20/month each, plus applicable usage/add-ons. [Pro billing](https://vercel.com/docs/plans/pro-plan)                                                                                                                         | Unknown.                                                          |
| Big Mac                               | Scraper, translations, local inference, image generation, search and trial hosting | Electricity + attributable hardware replacement/depreciation + backup/storage + any incremental internet cost.                                                                                                                                                                                                            | Unknown; power and purchase price were not measured.              |
| AI subscription behind the host proxy | Production text, image generation and review                                       | Actual subscription invoice × Billion's allocation share; add extra credits if purchased.                                                                                                                                                                                                                                 | Unknown; do not substitute public API token prices.               |
| Hosted AI and paid search             | Fallbacks or explicitly selected providers                                         | Reconcile actual provider/model usage and invoices. DeepSeek and BFL are configured; Tavily is available as an alternative.                                                                                                                                                                                               | Unknown.                                                          |
| Tavily, if selected                   | Research search                                                                    | Researcher includes 1,000 credits/month at $0; optional pay-as-you-go is $0.008/credit. [Pricing](https://www.tavily.com/pricing)                                                                                                                                                                                         | Host currently selects SearXNG. No paid Tavily usage established. |
| Expo / EAS                            | Cloud builds, submission and OTA updates                                           | Free: 15 Android + 15 iOS builds and updates to 1,000 MAUs. Starter: $19/month plus usage, $45 build credit and updates to 3,000 MAUs. Production: $199/month plus usage. [Pricing](https://expo.dev/pricing)                                                                                                             | Unknown; measure build usage and EAS Update MAUs separately.      |
| Apple Developer Program               | iOS distribution and TestFlight membership                                         | $99/year, equivalent to $8.25/month for planning. [Membership](https://developer.apple.com/programs/enroll/)                                                                                                                                                                                                              | Renewal receipt and allocation across apps unknown.               |
| PostHog                               | App/web analytics and any enabled additional products                              | Analytics includes 1 million events/month free; other products have separate meters and allowances. [Pricing](https://posthog.com/pricing)                                                                                                                                                                                | Unknown; an integration does not establish a paid plan.           |
| Resend                                | Feedback email, mailing-list contacts and confirmations                            | Transactional Free: 3,000 emails/month, capped at 100/day. Pro: $20/month for 50,000 emails, then $0.90/1,000. Marketing/contact-related charges must be checked separately. [Pricing](https://resend.com/pricing)                                                                                                        | Unknown.                                                          |
| Domain / DNS                          | Production address and renewals                                                    | Registrar's actual annual renewal ÷ 12; record DNS separately only if billed.                                                                                                                                                                                                                                             | Unknown.                                                          |
| Civic data and Google services        | Source access, licensed ballot data and optional address/Places requests           | Public-source access, service quotas and negotiated licenses are separate cost categories. Obtain the applicable SKU usage or signed quote.                                                                                                                                                                               | No current paid-license total established.                        |
| GitHub / CI and development tools     | Builds, packages, collaboration and coding assistants                              | Actual attributable plan, seat, runner and storage charges. Keep development subscriptions separate from production AI unless shared.                                                                                                                                                                                     | Unknown.                                                          |

Vercel's $0 Hobby plan is restricted to personal, non-commercial use; do not use it as the assumed commercial-production budget. [Hobby terms](https://vercel.com/docs/plans/hobby)

Billion uses Better Auth for application sessions. The presence of a Supabase project alone does not mean its Supabase Auth MAU meter equals Billion's app users. Likewise, EAS Update MAUs, analytics events, database egress and application MAUs are different units.

## 3. Monthly budget model

These scenarios assume a single Supabase Micro project, one Vercel deploying seat, no infrastructure overages or paid add-ons, and a full Apple membership allocation. PostHog and transactional Resend stay within their free allowances unless explicitly added.

| Planning scenario                       | Calculation                                | Monthly subtotal | Annual equivalent |
| --------------------------------------- | ------------------------------------------ | ---------------: | ----------------: |
| Paid hosting + iOS membership; EAS Free | $25 Supabase + $20 Vercel + $99 ÷ 12 Apple |           $53.25 |              $639 |
| Same, with EAS Starter                  | $53.25 + $19 Expo                          |           $72.25 |              $867 |
| Same, with EAS Starter and Resend Pro   | $72.25 + $20 Resend                        |           $92.25 |            $1,107 |

The annual equivalent is twelve times the monthly subtotal; it is not an annual-plan quote. Apple is paid annually, so actual monthly cash payments will differ.

Add the unresolved items to the appropriate subtotal:

> Monthly cash budget = selected service-plan subtotal + allocated production AI subscription + paid API usage + usage overages/add-ons + domain annual renewal ÷ 12 + incremental electricity/internet/backup costs + other recurring cash expenses.

For a full economic cost, also add hardware replacement/depreciation and paid or imputed labor. Track existing hardware purchases separately from recurring cash burn; do not count both the full purchase and depreciation as monthly operating expense. Shared accounts should have a consistent allocation rule, such as measured usage share, so the same subscription is not charged in full to several projects.

**Electricity illustration, not a measurement:** at an assumed average incremental draw of 100 W, 24 hours/day, a 30-day month and an assumed electricity rate of $0.30/kWh, the cost is `0.100 × 24 × 30 × $0.30 = $21.60/month`. Measure idle and workload draw and use the actual utility rate before treating this as Billion's cost. If the Mac would already be on for other work, use the attributable increment for the cash budget.

One-time or separately budgeted costs include hardware, backup equipment, test devices and, if Android distribution is pursued, Google's **$25 one-time** Play Console registration. [Google's fee](https://support.google.com/googleplay/android-developer/answer/6112435) Incorporation, accounting, insurance, legal review, data partnerships and marketing need their own quotes; no current amounts were verified here.

## 4. The immediate cost pressure: database egress

The [October 20 egress audit](reviews/egress-audit-2026-10-20.md) records a supplied notice of **7.42 GB used against a 5.5 GB quota**, plus read-only production measurements. That notice is historical evidence, not today's meter or a dollar invoice. The published Free allowance checked for this document is 5 GB; the reason for the notice's different threshold was not established.

The audit found:

- A translation archive sweep loaded approximately **70.79 MB** of serialized source, brief, lens and translated-reader data. The sampled logs scanned **2,488 readers, all already ready**, with no translations queued.
- Returning only the existing card fields reduced the estimated serialized bill payload by **91% across the stored corpus**. This is a database-result comparison, not a measured reduction in the total bill.
- Featured fetched hundreds of candidate rows to display six; pending translated cards could repeatedly refetch whole feeds.
- Stored artwork totaled approximately **371.8 MB**. Stored capacity is different from bytes downloaded each month.

Backend reads count too: data sent from Supabase through its shared pooler to Vercel or the Mac contributes to egress even if the backend discards most of it. Cached and uncached egress have separate quotas. [Supabase accounting](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

**October 22 incident and recovery:** three sampled production artwork URLs initially returned HTTP 402 with `exceed_egress_quota`, while core text APIs remained available. At 2:13 PM Pacific, all 11 repeat checks passed: homepage, Browse, bill/court/government lists, Featured, bill detail, the California guide with 14 measures, and those same three image URLs. Browser checks also confirmed an article's artwork, brief, original source text and archive search rendered successfully. Both Mac worker containers were running. This is a bounded recovery check; native-device flows, authenticated writes, image-generation uploads and every stored image were not exercised. The private Big Mac copy had zero of 2,215 image objects and 914 bills versus production's 948 at the earlier inspection. No hosting cutover was made. Payment and the exact renewal date remain unverified. Supabase documents that upgrading can lift quota restrictions; code changes cannot undo egress already consumed in the billing cycle. [Restriction handling](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

**Cost reductions already shipped:** [PR #510](https://github.com/billion-app/billion/pull/510) reduced translation archive reads, narrowed content queries and ranked Featured in SQL. [PR #511](https://github.com/billion-app/billion/pull/511) added bounded mobile translation polling and smaller artwork variants. The October 22 Vercel deployment and both Mac worker images were verified at `15e02b1f31f6e94d38d0b348342bc5069b583a80`, which includes both changes. Installed mobile/OTA rollout and backfill coverage for existing artwork were not verified. Savings have not been measured over a complete billing period; the one-minute audit sample is not a daily usage forecast.

## 5. AI and scraper estimates: what the logs do and do not mean

The [scraper cost estimator](../apps/scraper/src/utils/costs.ts) aggregates tokens and selected image/search calls using configurable rates. Its current defaults include $0.14 per million text-input tokens, $0.28 per million output tokens, $0.015 per hosted BFL image and $0.005 per Google Custom Search request. These are **code defaults**, not freshly verified prices for every provider or measured monthly spend.

The estimator accepts token counts without a provider/model billing identity. Some callers use it after provider selection, so local or subscription-backed generation can still receive a generic dollar estimate. Missing token counts contribute zero; the counters are in memory and can be reset. The model cannot account for the whole business: it excludes hosting, the AI subscription, hardware, electricity and several other meters.

For actual consumption, sum provider/model usage at the applicable rates, then reconcile credits, discounts and invoices. Do not add generic scraper estimates on top of a subscription invoice as though both were separate charges for the same work. Prepaid credit purchases belong in the cash record; consumed credits belong in the usage record.

Existing controls help contain work: stored-content reuse, enrichment budgets, source limits and failed-input backoff. [Scraper behavior](scraper.md) However, a limit is not always a monthly ceiling: repeated runs and retries can receive new allowances, and the scheduled image jobs use `--drain`, so their item limits are batch sizes rather than total-run caps. [Supervisor behavior](../apps/supervisor/README.md)

If Tavily is selected, the documented defaults allow ten uncached attempts per process and stop at an account-usage snapshot/configured ceiling of 800 monthly credits. Separate processes can consume credits concurrently; that mechanism is not a universal billing cap. The current inspected host selects SearXNG instead. [Search configuration](../deploy/big-mac/README.md#free-tier-search-with-tavily)

## 6. Existing research and evidence gaps

[Issue #113](https://github.com/billion-app/billion/issues/113) is the earlier consolidated research on structure, funding, partnerships and API costs; it supersedes [#111](https://github.com/billion-app/billion/issues/111). It is useful historical context but is not a current expense ledger. In particular, its hosted-image prices and CourtListener description should not replace the present source registry and host configuration. Its referenced `docs/research/api-pricing-and-incorporation-2026.md` was absent from this checkout and was not recovered from the available local Git history.

The [civic-source guide](civic-data-sources.md) identifies licensed Democracy Works access and optional integrations. It also contains conflicting Vote Smart descriptions: the table labels an organizational tier free, while the prose says organizational fees apply. Treat Vote Smart pricing as **quote required**, and do not turn broad historical “thousands/month” statements about ballot vendors into a current obligation. The [existing Billion Page](https://chatgpt.com/space/page_3679eba915248191a27ae278eb3a3223) recorded missing Democracy Works access on September 30; that is dated context, not an October 22 configuration check.

Evidence reviewed: initial checkout `2002ecd040f9ae69b21edb9dd5fd3594e2277936`, followed by production deployment and worker revision `15e02b1f31f6e94d38d0b348342bc5069b583a80`; local egress-audit and private-copy documents; live HTTP probes and read-only database counts; selected Big Mac configuration and container/job status; GitHub issues and merged PRs; the existing Billion Page; and official pricing pages. This investigation did not modify production data, launch ingestion, change a paid plan or cut over hosting.

**Billing access limits:** Gmail required reauthentication, so receipts could not be inspected. The connected Supabase account's project list did not include Billion, and the browser dashboard required sign-in. Vercel's runtime-log API identified the production team as Hobby; its invoices and any separate account charges were not inspected. No invoice-backed monthly total is asserted.

## 7. What would establish actual monthly spend

Use the most recent complete billing periods, retaining provider-specific start/end dates; keep October-to-date usage separate from a complete month.

| Missing input                           | What to record                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Supabase organization billing and usage | Plan, projects/compute, database versus Storage/pooler egress, cached egress, add-ons, credits, tax and invoice total.  |
| Vercel billing                          | Plan, deploying seats, included credit, overages/add-ons and Billion's share of any shared team invoice.                |
| AI subscription and provider accounts   | Subscription invoice/allocation; DeepSeek/BFL/Tavily and other actual usage; extra-credit purchases versus consumption. |
| Expo, PostHog and Resend                | Current plans, billing-period usage by product, extra usage and invoices.                                               |
| Apple and domain                        | Renewal amount/date, existing credits and allocation across projects.                                                   |
| Big Mac and overhead                    | Purchase/replacement basis, measured power, electricity rate, incremental connectivity, backups and labor.              |
| Civic licenses                          | Signed agreement or current vendor quote, coverage and billing cadence.                                                 |

For each expense, retain **service, billing period, currency, gross charge, credits, net charge, tax, Billion allocation, receipt/source link and monthly equivalent**. Once those rows are filled, replace the provisional subtotal with a verified cash total and show hardware/labor allocation separately.
