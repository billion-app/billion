# Civic Data Sources

This document explains how to set up API keys and access for all civic data integrations in Billion.

## Quick Reference

| Source                                 | Key Required | Cost           | Env Variable           |
| -------------------------------------- | ------------ | -------------- | ---------------------- |
| Google Civic API                       | Yes          | Free (25k/day) | `GOOGLE_CIVIC_API_KEY` |
| Open States API                        | Yes          | Free           | `OPEN_STATES_API_KEY`  |
| CA Secretary of State                  | Yes          | Free           | `CA_SOS_API_KEY`       |
| Legistar (local councils)              | No           | Free           | —                      |
| VOTE411 (scraper)                      | No           | Free           | —                      |
| Santa Clara ROV (scraper)              | No\*         | Free           | —                      |
| CA SOS Voter Guide (scraper)           | No           | Free           | —                      |
| Santa Clara measure pipeline (scraper) | No           | Free           | —                      |

\*Uses Google Civic API internally

> **Ballot measure enrichment.** The CA SOS Voter Guide and Santa Clara measure
> scrapers feed a cross-validation engine that fills in measure summaries,
> fiscal impact, and pro/con arguments with per-field source attribution. See
> [`MEASURE_ENRICHMENT.md`](./MEASURE_ENRICHMENT.md).

---

## Google Civic Information API

**Provides:** Elections, polling locations, ballot info, elected representatives

**Quota:** 25,000 requests/day (free)

### Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Library**
4. Search for "Google Civic Information API"
5. Click **Enable**
6. Go to **APIs & Services** → **Credentials**
7. Click **Create Credentials** → **API Key**
8. Copy the key

### Environment Variable

```bash
GOOGLE_CIVIC_API_KEY=AIza...your_key_here
```

### Optional: Restrict Key

For production, restrict the key:

- **Application restrictions:** HTTP referrers or IP addresses
- **API restrictions:** Google Civic Information API only

---

## Open States API

**Provides:** California state bills, legislators, voting records, legislative sessions

**Quota:** Generous free tier

### Setup

1. Go to [Open States Sign Up](https://openstates.org/accounts/signup/)
2. Create an account and verify email
3. Go to [Your Profile](https://openstates.org/accounts/profile/)
4. Scroll to **API Keys** section
5. Click **Generate New Key**
6. Copy the key

### Environment Variable

```bash
OPEN_STATES_API_KEY=your_key_here
```

### Documentation

- API Docs: https://docs.openstates.org/api-v3/
- GraphQL Explorer: https://openstates.org/graphql

---

## California Secretary of State API

**Provides:** Election results, contest data, county-level vote breakdowns

**Quota:** Free with registration

### Setup

1. Go to [CA SOS Developer Portal](https://calicodev.sos.ca.gov/)
2. Click **Sign Up** to create an account
3. After verification, go to **Products** → **Election Results API**
4. Click **Subscribe** to get access
5. Go to **Profile** → **Subscriptions**
6. Copy your **Primary Key** or **Secondary Key**

### Environment Variable

```bash
CA_SOS_API_KEY=your_subscription_key_here
```

### Documentation

- Developer Portal: https://calicodev.sos.ca.gov/
- API Base URL: https://api.sos.ca.gov/

### Notes

- API uses Azure API Management
- Results are most active during election nights
- Historical data available for past elections

---

## CA SOS Official Voter Guide (scraper)

**Provides:** Official statewide proposition summaries (Attorney General), LAO
fiscal-impact analyses, arguments in favor / against, full-text links.

**No API key required** (scraper). Source: `https://voterguide.sos.ca.gov`.

This is distinct from the CA SOS _Election Results_ API above — the voter guide
carries the human-written, official measure content. It feeds the ballot-measure
cross-validation engine (`packages/api/src/lib/measure-sources/ca-sos-voterguide.ts`).

### Notes

- California statewide propositions only (local measures use the county pipelines).
- Matched by proposition number parsed from the Google Civic measure title.
- Defensive: failures fall back cleanly without breaking the request.

---

## Santa Clara Measure Pipeline (scraper)

**Provides:** Local (lettered) measure summaries and fiscal impact for Santa
Clara County — the proving ground for the county-level pipeline.

**No API key required** (scraper).

### Sources

1. Santa Clara County Registrar of Voters (`vote.santaclaracounty.gov`) —
   official, but Cloudflare-protected, so it may be unavailable.
2. League of Women Voters Easy Voter Guide (`easyvoterguide.org`) — nonpartisan
   fallback.

Implemented in `packages/api/src/lib/measure-sources/santa-clara.ts`. See
[`MEASURE_ENRICHMENT.md`](./MEASURE_ENRICHMENT.md) for the full pipeline.

---

## Legistar Web API

**Provides:** Local city council meetings, legislation, votes, agendas

**Quota:** Unlimited (public data)

**No API key required.**

### Supported Jurisdictions

| Jurisdiction       | Legistar Client ID | Website                  |
| ------------------ | ------------------ | ------------------------ |
| San Jose           | `sanjose`          | sanjose.legistar.com     |
| Santa Clara County | `santaclara`       | sccgov.legistar.com      |
| Sunnyvale          | `sunnyvale`        | sunnyvaleca.legistar.com |

### Usage

```typescript
import { legistar } from "@acme/api";

// Get San Jose city council meetings
const meetings = await legistar.getMeetings("sanjose");

// Search legislation
const bills = await legistar.getLegislation("sanjose", { text: "housing" });
```

### Adding More Jurisdictions

Many California cities use Legistar. To add a new one:

1. Find the city's Legistar URL (e.g., `mountainview.legistar.com`)
2. Extract the client ID (the subdomain before `.legistar.com`)
3. Add to the `JURISDICTIONS` constant in `packages/api/src/integrations/legistar.ts`

### Documentation

- API Base: https://webapi.legistar.com/
- OData-compatible queries supported

---

## VOTE411 / League of Women Voters

**Provides:** Nonpartisan voter guides, candidate questionnaire responses, ballot measure explanations

**Quota:** Rate-limited (be respectful)

**No API key required** (web scraper).

### Usage

The scraper extracts data from vote411.org. Rate limiting and caching are built in.

### Notes

- Data updates closer to elections
- Candidate responses depend on candidate participation
- Also check https://cavotes.org/easy-voter-guide/ for California-specific guides

---

## Santa Clara County ROV Scraper

**Provides:** Sample ballots, polling locations, election calendar, candidate filings

**No direct API key required** — uses Google Civic API internally.

### Setup

Ensure `GOOGLE_CIVIC_API_KEY` is set (see Google Civic section above).

### Why Not Direct Scraping?

The Santa Clara County Registrar of Voters website (vote.santaclaracounty.gov) uses Cloudflare bot protection, making direct scraping unreliable. The scraper uses Google Civic API as a proxy data source.

### Running

```bash
# Run Santa Clara ROV scraper
pnpm scraper santaclararov

# Run all scrapers
pnpm scraper all
```

---

## Environment Setup

Add all keys to your `.env` file:

```bash
# Required for most civic features
GOOGLE_CIVIC_API_KEY=AIza...

# Required for CA state legislation
OPEN_STATES_API_KEY=...

# Required for election results
CA_SOS_API_KEY=...
```

For local development, copy `.env.example` to `.env` and fill in your keys.

---

## Paid APIs (Future Expansion)

These provide more comprehensive data but require paid subscriptions:

### BallotReady

- Full ballot data + endorsements
- Contact: https://organizations.ballotready.org/ballotready-api

### Ballotpedia

- Candidate bios, detailed election coverage
- Contact: https://developer.ballotpedia.org/

### Democracy Works

- Comprehensive election data
- Contact: https://www.democracy.works/elections-api

### Vote Smart

- Free for research/nonprofit use
- Voting records, interest group ratings
- Register: https://votesmart.org/share/api
