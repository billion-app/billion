# Civic Data Source Setup

How to obtain keys/access for every civic integration. For local dev, copy `.env.example` to `.env` and fill in the keys below. (Every key is optional — see [Mock data](../CONTRIBUTING.md#mock-data--development-without-api-keys).)

| Source                                 | Key required | Cost            | Env variable                                                          |
| -------------------------------------- | ------------ | --------------- | --------------------------------------------------------------------- |
| Google Civic API                       | Yes          | Free (25k/day)  | `GOOGLE_CIVIC_API_KEY`                                                |
| Open States API                        | Yes          | Free            | `OPEN_STATES_API_KEY`                                                 |
| Google Places (address autocomplete)   | Yes          | Pay-as-you-go   | `GOOGLE_PLACES_API_KEY` (→ `GOOGLE_API_KEY` → `GOOGLE_CIVIC_API_KEY`) |
| Vote Smart                             | Yes          | Free (org tier) | `VOTE_SMART_API_KEY`                                                  |
| Legistar (local councils)              | No           | Free            | —                                                                     |
| VOTE411 / LWV (scraper)                | No           | Free            | —                                                                     |
| CA SOS Voter Guide (scraper)           | No           | Free            | —                                                                     |
| Santa Clara measure pipeline (scraper) | No           | Free            | —                                                                     |

> ⚠️ **`CA_SOS_API_KEY` is dead cruft.** Earlier docs listed it for election results, but the results client uses the free, keyless `media.sos.ca.gov` endpoint — the key is unused in code. Safe to drop from `.env.example`.

**Google Civic Information API** — elections, polling locations, ballot info, representatives; 25k req/day free. [Cloud Console](https://console.cloud.google.com/) → create/select project → APIs & Services → Library → enable "Google Civic Information API" → Credentials → Create API Key. For production, restrict the key (HTTP referrers/IP + this API only). → `GOOGLE_CIVIC_API_KEY`.

**Open States API** — CA state bills, legislators, voting records. [Sign up](https://openstates.org/accounts/signup/) → verify email → [profile](https://openstates.org/accounts/profile/) → API Keys → Generate. Docs: <https://docs.openstates.org/api-v3/>. → `OPEN_STATES_API_KEY`.

**Google Places (Autocomplete New)** — US street-address autocomplete for the ballot lookup. Same Cloud Console flow as Civic; enable "Places API (New)". Reuses the Google key chain. See `packages/api/src/lib/places.ts` (session-token billing). → `GOOGLE_PLACES_API_KEY`.

**Vote Smart** — voting records, candidate bios, measure pro/con. Access is **member vs. business/organizational** (not nonprofit vs. for-profit) — org fees apply; ToS bars use "in any campaign activity". [Register](https://votesmart.org/share/api). → `VOTE_SMART_API_KEY`.

**Legistar Web API** — local council meetings, legislation, votes, agendas; no key, unlimited public data. Supported jurisdictions (client id): San Jose (`sanjose`), Santa Clara County (`santaclara`), Sunnyvale (`sunnyvale`). Add a city by extracting its `*.legistar.com` subdomain into the `JURISDICTIONS` constant in `packages/api/src/integrations/legistar.ts`. Base: <https://webapi.legistar.com/> (OData-compatible).

**VOTE411 / League of Women Voters** — nonpartisan voter guides, candidate questionnaires, measure explanations; no key (scraper, rate-limited + cached). ⚠️ ToS bars commercial use without **written consent** and prohibits automated queries — a negotiated partnership is the only compliant path (tracked in the Outreach Tracker). Also `cavotes.org/easy-voter-guide/` for CA.

**CA SOS Official Voter Guide (scraper)** — official statewide proposition summaries (AG), pro/con arguments, full-text links; no key. Source `voterguide.sos.ca.gov`. Distinct from the (dead) results API — this carries the human-written official measure content and feeds the cross-validation engine (`measure-sources/ca-sos-voterguide.ts`). CA statewide only; local measures use the county pipelines.

**CA Legislative Analyst's Office / LAO (scraper)** — official nonpartisan fiscal impact analyses for every CA statewide proposition, 1996–present; no key, no API. Source `lao.ca.gov/BallotAnalysis/Proposition?number=N&year=YYYY` — HTML scrape, no structured data endpoint exists. The `ca-lao-fiscal` scraper pre-warms `CivicApiCache` in the ~90-day pre-election window; the `measure-sources/ca-lao-fiscal.ts` adapter serves those rows at request time (falls back to a live fetch on cache miss). Registered at `state_sos` tier — LAO fiscal text wins over Ballotpedia/Wikipedia when present.

**Santa Clara measure pipeline (scraper)** — local lettered measure summaries + fiscal impact for Santa Clara County, the proving ground for county-level ingestion; no key. Sources: SCC Registrar (`vote.santaclaracounty.gov`, Cloudflare-protected so sometimes unavailable) with the LWV Easy Voter Guide (`easyvoterguide.org`) as nonpartisan fallback.

**Paid APIs (future, benchmark only):** BallotReady (full ballot + endorsements), Ballotpedia (candidate bios, detailed coverage), Democracy Works (comprehensive election data). All cost thousands/month and are fallback/gap-fillers only — see the [Outreach Tracker](https://github.com/orgs/billion-app/projects/3) for evaluation status.
