# Civic Data Sources

This document explains how to set up API keys and access for all civic data integrations in Billion.

## Quick Reference

| Source                         | Key Required | Cost           | Env Variable           |
| ------------------------------ | ------------ | -------------- | ---------------------- |
| Google Civic API               | Yes          | Free (25k/day) | `GOOGLE_CIVIC_API_KEY` |
| Open States API                | Yes          | Free           | `OPEN_STATES_API_KEY`  |
| CA SOS Election Results API    | Yes          | Free           | `CA_SOS_API_KEY`       |
| CA SOS Official Voter Guide    | No           | Free           | —                      |
| Legistar (local councils)      | No           | Free           | —                      |
| VOTE411 (scraper)              | No           | Free           | —                      |
| Santa Clara ROV local measures | No           | Free           | —                      |

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

## California Official Voter Guide

**Provides:** Official statewide proposition summaries, "what your vote means" text, arguments, fiscal impact text, and links to the full proposed law.

**No API key required.** The API layer reads public Official Voter Information Guide HTML from:

- Current guide: https://voterguide.sos.ca.gov/
- Archived guides: https://vigarchive.sos.ca.gov/

### Runtime Integration

Statewide California propositions are enriched in `packages/api/src/lib/civic.ts` before Vote Smart and before AI summaries:

1. Google Civic returns a ballot contest with a title such as `Proposition 36`.
2. `packages/api/src/lib/california-measures.ts` detects the proposition number.
3. The official voter-guide page is fetched and parsed.
4. Parsed official fields are merged into the Google Civic contest.
5. Parsed source records are cached in the `civic_api_cache` table.

### Source Priority

For statewide California propositions, official SOS voter-guide fields win over Vote Smart, Google Civic, and AI-generated summaries. Vote Smart remains useful as a state-level fallback when SOS pages are not available for a given election.

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

## Santa Clara County ROV Local Measures

**Provides:** Local ballot measure questions, measure letters, jurisdictions, vote thresholds, and links to official argument/analysis PDFs where the county publishes them.

**No API key required.**

### Official Source

Santa Clara County publishes a public local-measures list for each election:

- https://vote.santaclaracounty.gov/list-local-measures-0

The current implementation uses this source as the California proving ground for local measures. When a Google Civic contest title contains `Measure A`, `Measure B`, etc. and the voter context appears to be Santa Clara County or a Santa Clara County city, the API parser looks up the matching county measure and fills the official ballot question plus source attribution.

Because the county site may return bot-protection responses to server-side fetches, the API also includes a small 2024 fallback catalog for the San Jose/Santa Clara proving-ground measures. The fallback text is copied from the county's published local-measures page and points users back to the same official source URL.

### Running

This enrichment runs inside `civic.getVoterInfo`; there is no standalone scraper command yet.

The county site should still be treated as the canonical source for local ballot-measure text. If future county pages require PDF extraction, the scraper pipeline should extract source text first and use AI only to structure that text, not to invent missing content.

---

## Ballot Measure Enrichment Rules

### Source Priority

1. County registrar voter guide or local-measures page
2. California SOS Official Voter Information Guide
3. Vote Smart
4. Google Civic
5. AI summary from source material only

Every official enrichment appends source metadata to the contest `sources` array with `name`, `official`, `url`, and `fields`.

### AI Guardrails

AI can be used to summarize or structure existing public-record text. It must not generate measure summaries from a title alone. If no source material is available, the UI should show that details are unavailable rather than presenting a fabricated summary.

### Cache Strategy

Official measure-source fetches use `civic_api_cache` with a global cache key and a 30-day TTL. Address-specific Google Civic voter-info responses continue to use the existing address-hash cache.

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
