# Disabled scrapers

Scrapers that are kept in the tree but **not registered** in `main.ts`, so they
never run. They still typecheck (imports are kept valid) so they're easy to
revive, but they are excluded from the scraper list and the env registry.

## `ca-vig-archive.ts`

Scrapes historical CA statewide propositions from `vigarchive.sos.ca.gov` into
`CivicApiCache`. Disabled because **nothing reads the data back**: the measure
cross-validation engine (`@acme/api/lib/measure-crossvalidate`) collects only
from the SOS voter guide, CalVotes, Ballotpedia, Wikipedia, Vote Smart, and the
LAO — there is no `enrichFromVigArchive`, so the cache rows it wrote were never
queried. The pure parser lives beside it at
`@acme/api/lib/measure-sources/disabled/vig-archive`.

To revive it: add an `enrichFromVigArchive` source into `crossValidateMeasure`,
re-register the scraper in `apps/scraper/src/main.ts`, add `"ca-vig-archive"`
back to `scraperNames` in `@acme/env`, and note that the archive has two page
layouts — modern (`/{year}/{type}/propositions/{N}/`) and old
(`/{year}/{type}/propositions/prop{N}-title.htm`, indexed by `propositions.htm`);
the current parser only handles the modern one.

## `ca-lao-fiscal.ts`

Scraped LAO ballot fiscal analyses into `CivicApiCache` under endpoint
`ca-lao-fiscal`. Disabled because **nothing reads that cache**: the app's
`enrichFromLao` (`@acme/api/lib/measure-sources/ca-lao-fiscal`) fetches lao.ca.gov
**live** at request time and never touches the scraper's rows — so the scraper
was redundant. (That live enricher module is still in use and stays put; only the
scraper here is disabled.)

To revive it: make `enrichFromLao` read the `ca-lao-fiscal` `CivicApiCache` rows
before falling back to a live fetch, then re-register + re-add to `scraperNames`.

## `vote411.ts` / `vote411-ballot.ts`

`vote411.ts` scraped League of Women Voters voter guides + candidate forums;
`vote411-ballot.ts` was an unfinished Playwright-based ballot lookup. Both write
only to a local `.cache/vote411*/` directory on the scraper host and were **never
read by the app** — `vote411.ts`'s own `scrape()` says "for now, we just scrape
and cache the data," and its `getCached*` getters are imported nowhere.
`vote411-ballot.ts` was never even registered in `main.ts`.

To revive: have the scraper persist to the database (a real table the API reads),
add a reader in `@acme/api`, then re-register + re-add to `scraperNames`.
