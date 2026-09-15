# Replacing Google Civic for October: provider research

Research date: September 15, 2026 UTC. Read-only primary-source review for #332,
#337 and Arnav's provider migration work. This report recommends a direction; it
implements no migration and certifies no provider's address-level coverage.

## Recommendation

**Evaluate BallotReady first for the ballot itself, with Democracy Works as the
best documented combined ballot-and-logistics alternative.** Keep Ballotpedia's
geographic API as a third option if its licensed 2026 local coverage is materially
better for our launch jurisdictions. These are evaluation priorities, not purchase
recommendations backed by tested data. No alternative key, quote, contract or live
address response was obtained in this research.

For October, plan a limited, explicitly described ballot preview with official
lookup links everywhere. Release only the jurisdictions and election selections
that pass official comparison. If access, licensing or accuracy cannot be settled
in time, launch the official-lookup fallback instead of promising a complete
national ballot. Repairing Google's credential is not the proposed path forward.
The [historic probe](evidence/2026-09-15-endpoint.json) remains unchanged as evidence
of that earlier investigation.

## Shortlist

| Option                  | Concrete product                                        | Best fit                                            | Main unresolved decision                                         |
| ----------------------- | ------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| BallotReady             | GraphQL API and structured exports                      | Broad down-ballot lookup and candidate context      | Exact licensed tiers, current schema and 2026 address tests      |
| Democracy Works         | REST v2 elections, authorities and voting-location APIs | One integration for ballots, guidance and logistics | Local ballot limits and any remaining upstream Google dependency |
| Ballotpedia             | Geographic REST API and bulk JSON/CSV                   | Candidates, measures and source-linked profiles     | Geocoder, licensed geographic coverage and separate logistics    |
| Direct official sources | Jurisdiction-specific portals/documents/feeds           | Ground truth and fallback                           | No verified unified national address-to-ballot service           |

### BallotReady: strongest first evaluation for down-ballot breadth

Its [API product page](https://organizations.ballotready.org/ballotready-api)
offers GraphQL and one-time or ongoing exports, ballot and turnout products,
district/subdistrict mapping, candidate information, measures and polling details.
It says the database refreshes daily and reports a historical peak above 1,100
requests/second. Those are vendor claims, not a measured SLA. Pricing and test
access require contact; no public dollar price was found there. The page describes
research from election offices, including direct requests for records.

The [data-tier policy](https://support.ballotready.org/article/733-ballotready-data-tiers),
opened with an August 11, 2026 update date, is more specific than “every ballot”:
regularly scheduled elections need at least one Tier 1–3 position. Federal,
state executive/legislative/board and county positions are included; municipal
Tier 3 requires a city above 50,000 residents. Small towns, school boards and
special districts have population-based Tier 4/5 restrictions. Measures default
to Tiers 1–3. The introduction says candidates through Tier 4 are included, while
the Tier 4 heading says add-on. That internal inconsistency requires written
clarification before estimating cost or coverage. Elections outside the qualifying
rule are excluded even with additional depth. Do not infer special-election coverage.

The [developer landing page](https://developers.civicengine.com/) advertises an
API, address widget and components separately. During this review its GraphQL
and widget documentation links returned the landing content rather than usable
schema documentation. Consequently direct text-address arguments, election-ID
filtering, provenance fields, rate limits, error behavior and any upstream geocoder
remain **unverified**. Do not implement from an old third-party gist. Obtain the
current schema and test access through the authorized project owner later.

**2026 evidence:** a current coverage policy, not a measured November ballot.
Require returned candidate and measure inventories for the planned jurisdictions.

### Democracy Works: most explicit current integration contract

[REST v2 documentation](https://developers.democracy.works/api/v2) specifies API-key
access and a contact path for pricing/test keys. `/elections` accepts street
addresses, supports ballot inclusion, and returns elections chronologically;
retain individual election identity because OCD-ID alone is not unique.
Ballot data comes from Ballotpedia. Documented coverage includes federal/state
contests, local races in the largest 100 cities and school boards in 475 districts,
with mapping limitations; measures include statewide and largest-100-city local
coverage. `/voting-locations` accepts address components and defaults to published
data. Keep that default. Guidance phases describe the provider's guidance, not
an official ballot-publication date. Examples are fictional and establish no 2026
availability. Confirm licensed endpoint entitlements, pagination and election
matching during a trial; the documented location request does not expose an
explicit election-ID parameter.

The [product page](https://www.democracy.works/elections-api) describes election
guidance for jurisdictions above 5,000 people, official action links, a canonical
source/research page, and enterprise SLAs without a public numeric guarantee.
That guidance scope must not be substituted for the narrower ballot scope above.
It explicitly lists Google Civic among upstream tools. An integration with Democracy
Works would remove Billion's direct Civic calls, but public evidence does not prove
an entirely Google-independent supply chain.

Its [research process](https://www.democracy.works/research) describes ongoing
monitoring, two QA rounds and official-government sourcing for election guidance.
It also says Civic is used to find OCD-IDs and that some rules/dates are determined
from legislation pending official confirmation. Ask which current endpoints still
rely on Google and require an official citation for each deadline Billion displays.
No fixed per-record update interval or independently measured uptime was established.

**2026 evidence:** current product/schema scope, not authenticated 2026 contents.
This is a strong trial candidate if local limitations are acceptable and the Google
dependency question is resolved to the user's intended standard.

### Ballotpedia: ballot API with a separate geocoding responsibility

The [practical guide](https://developer.ballotpedia.org/geographic-apis/practical-guide)
requires coordinates: geocode the address, discover applicable election dates,
then request the chosen date's ballot. It suggests external geocoders. Manual
address entry therefore does not by itself solve this provider's location step.

[`/elections_by_point`](https://developer.ballotpedia.org/geographic-apis/elections_by_point)
returns races, candidates and measures for a point and election date, but omits
races with no official candidates. Empty output cannot prove there is no election.
It includes Ballotpedia page links; original official-document provenance still
needs inspection. [`/election_dates`](https://developer.ballotpedia.org/geographic-apis/election_dates)
has point-based discovery and date/type/ID examples. Its list endpoint demonstrates
`candidate_lists_complete`; do not assume that flag certifies a whole address's
ballot or is present on every endpoint. Test multiple elections on the same date.

The [access guide](https://developer.ballotpedia.org/geographic-apis/getting-started-with-geographic-apis)
requires an active key and says returned fields depend on the purchased package.
It documents change notices of one month for small changes and three months for
larger changes, with avoidance near major elections. Browser use requires domain
allowlisting; Billion should keep keys server-side regardless. No numeric price,
quota or uptime guarantee was established. [Bulk delivery](https://developer.ballotpedia.org/bulk-data/downloading-bulk-data-via-the-client-portal)
is a real client product with JSON/CSV refreshed every 24 hours, not a public dump.
No address-specific polling endpoint was established in these docs.

**2026 evidence:** Ballotpedia's own [June coverage report](https://news.ballotpedia.org/2026/05/29/elections-ballotpedia-is-covering-in-june-2026/)
describes actual 2026 research across 26 states, including municipal races; its
[May report on California measures](https://news.ballotpedia.org/2026/05/26/voters-across-34-california-counties-will-decide-on-113-local-ballot-measures-on-june-2/)
shows local-measure research. Editorial coverage does not establish geographic API
mapping, November availability or Billion's licensed fields. Request an explicit
2026 coverage inventory, especially outside large cities, rather than copying
Democracy Works's licensed scope or older Ballotpedia coverage figures.

## Other paths and why they are not the October default

- **VIP:** [its FAQ](https://www.votinginfoproject.org/faq) offers a free embeddable
  voting-location tool, says data is usually published 2–3 weeks before elections,
  and directs custom developers to Google Civic. That typical timing is not a
  publication promise for any address. The [open specification](https://github.com/votinginfoproject/vip-specification)
  defines a feed format; its license does not establish access rights or availability
  for every current state feed. Direct feeds need a distribution agreement and
  address/precinct integration assessment; the widget is not a verified Google-free API.
- **VOTE411:** a useful consumer guide, but its [terms](https://www.vote411.org/legal)
  require permission for automated queries and third-party redistribution.
  No usable public API agreement was established. Do not build a scraping dependency.
- **Election.org:** [public beta API docs](https://www.election.org/data/api) describe
  keyless access, attribution/source metadata and an expressly incomplete federal
  filing-record ballot preview. The documented 2026 federal filings are not ballot
  qualification; listed measure coverage is concentrated in California/Los Angeles.
  Upstream licenses still apply. No production SLA or national complete-ballot
  scope was established. Interesting research input, not the launch ballot authority.
- **Census:** the [geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html)
  can turn typed addresses into coordinates/geographies using selected benchmarks
  and vintages. It supplies geography, not candidate slates, measures or polling
  assignments. `Current` changes over time; record the dataset vintage and validate
  election boundaries. It is a candidate geocoding experiment, not a ballot replacement.

## Manual addresses and Arnav's ownership

Yes: a street/city/state/ZIP form can avoid Billion calling Google Places. Democracy
Works explicitly accepts those components, making it the clearest documented path.
BallotReady's current direct-address schema still needs verification. Ballotpedia
requires a non-Google geocoder before its point lookup. None of these proves that
the vendor itself uses no Google services.

Leave AddressAutocomplete, the Elections tab, navigation, #272 explanatory content
and provider migration to Arnav. Hand this report to the coordinator; no teammate
contact occurred. Suggested handoff: Arnav owns input UX and production adapter;
#332 owns sample evidence; #329/#330 consume stable, provider-neutral election
identity and availability states; #331 consumes sourced logistics; #335 verifies
read-only serving; #337 decides release scope. Do not force a new API into Google's
`otherElections` shape: preserve equivalent selection semantics with namespaced IDs.

## Proposed bounded proof of concept and October gate

These are proposed internal dates and tests, not external election deadlines.
No trial, account creation or purchase was performed.

1. **By September 18:** project owner obtains permitted test access and written
   terms for BallotReady and Democracy Works, plus Ballotpedia if either cannot
   qualify. Request exact November 2026 jurisdictions, candidate/measure tiers,
   data provenance, upstream Google dependencies, quote, minimum term, quotas,
   overages, refresh schedule, correction response and election-period support.
   Confirm mobile/public display, caching, retained test evidence, attribution,
   redistribution and AI explanation permissions. Public marketing is not a license.
2. **By September 25:** prepare two consented residential samples per state in the
   [15-state plan](samples.json), including boundary/rural/school-district cases.
   Start with one provider. Limit a trial to 120 requests total: at most four per
   address for location/election discovery, selected ballot and logistics. Count
   pagination against the cap; stop and record incomplete rather than silently
   raising the budget. No enrichment or application cache/database writes.
3. Compare every returned race/candidate/measure for those selected elections with
   official sample ballots. Record missing and extra contests separately from
   missing source documents and provider errors. Capture selected IDs, mapping
   version, timestamps, provenance, HTTP errors and latency. Keep addresses private.
   A missing official comparison blocks a completeness claim, not all useful display.
4. **By September 28:** pick one provider only if contract and tested scope meet
   requirements. Zero unexplained wrong-address/election/district assignments and
   zero known candidate/measure discrepancies in the proposed release scope.
   All displayed deadlines need official citations. Test timeout, throttling,
   unavailable data, alternatives and stale data using offline fixtures as well.
   A small sample is not evidence of production uptime or statewide completeness.
5. **By October 1:** Arnav and the integrating tasks can target a scoped preview,
   contingent on their own implementation/production checks. Any unresolved area
   goes to official lookup. Repeat the sample weekly and after provider corrections;
   #337 records the supported scope. No national-readiness claim or launch-flag
   change follows from this research alone.

The existing harness is Google-specific and remains historical tooling. A later,
authorized POC needs a separate adapter for the chosen provider and the same
sanitized evidence rules. Do not point it at a new hostname and assume schemas,
error semantics, election identifiers or permissions are interchangeable.
