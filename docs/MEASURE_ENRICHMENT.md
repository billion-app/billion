# Ballot Measure Enrichment

How Billion turns a bare ballot-measure title into a source-attributed record
with an official summary, fiscal impact, pro/con arguments, and full text.

## The problem

The Google Civic Information API reliably returns ballot-measure **titles** but
almost never populates the content fields (subtitle, pro/con, fiscal impact,
full text) — especially for local (city/county) measures. The expanded measure
cards in the app were therefore mostly empty.

All of this data is **public record**. Paid aggregators (Ballotpedia,
BallotReady) just structure it. So instead of paying for a thin API, we combine
several free, official sources and cross-validate them.

## Architecture

```
County Registrar (Santa Clara) ─┐
CA SOS Official Voter Guide  ────┤
Vote Smart API               ────┼──▶ Cross-Validation Engine ──▶ Canonical Measure ──▶ Cache (CivicApiCache) ──▶ App
Google Civic API             ────┘        │ merge by trust tier        │ citation on every field
                                          │ AI structures, never authors
                                          └── flags discrepancies for review
```

- **Engine:** `packages/api/src/lib/measure-crossvalidate.ts`
- **Source adapters:** `packages/api/src/lib/measure-sources/`
- **Entry point:** `enrichContest()` in `packages/api/src/lib/civic.ts`, run by
  `civic.getVoterInfo`.

## Trust tiers

When more than one source covers the same field, the higher tier wins:

```
county_registrar > state_sos > vote_smart > google_civic > ai_generated
```

Defined in `measure-sources/types.ts` (`SOURCE_TIER_RANK`).

## Source adapters

### CA Secretary of State — Official Voter Guide (`ca-sos-voterguide.ts`)

- **Scope:** California statewide propositions only.
- **Source:** `https://voterguide.sos.ca.gov/propositions/<n>/`
- **Extracts:** official Attorney-General summary, Legislative Analyst (LAO)
  fiscal impact, arguments in favor / against, full-text URL.
- These are **real, official** texts — not AI-generated.
- Matches on the proposition number parsed from the title ("Proposition 36").

### Santa Clara County (`santa-clara.ts`) — the proving ground

- **Scope:** local lettered measures ("Measure A").
- **Primary source:** Santa Clara County Registrar of Voters
  (`vote.santaclaracounty.gov`). The county site sits behind Cloudflare, so this
  can fail; when it does we fall back to the **League of Women Voters Easy Voter
  Guide** (nonpartisan).
- Matches on the measure letter parsed from the title.

### Vote Smart (`votesmart.ts`)

- **Scope:** state-level measures. Fuzzy-matches the title to a Vote Smart
  measure and returns summary, full-text URL, pro/con URLs. Requires
  `VOTE_SMART_API_KEY`.

### Google Civic

- The measure as the API returned it — treated as the lowest-trust source so
  its subtitle/text/statements still surface when nothing better exists.

## AI's role (explicitly scoped)

- **YES** — summarize official fiscal-impact analyses into plain language;
  reconcile and structure existing source text.
- **NO** — generate pro/con arguments from scratch; invent a summary when no
  source material exists (the UI shows "No information available" instead).
- **Fallback only** — when there _is_ source material but no human summary, an
  AI summary is generated and **flagged** (`Contest.summaryIsAiGenerated`) so
  the app labels it "AI-generated — not from an official source".

## Output shape

`crossValidateMeasure` returns a `CanonicalMeasure`, mapped onto the existing
`Contest` type:

| Field                               | Meaning                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `summary`                           | best available summary (official preferred)                                         |
| `summaryIsAiGenerated`              | true if `summary` came from AI                                                      |
| `fiscalImpact`                      | official fiscal analysis                                                            |
| `proArguments[]` / `conArguments[]` | attributed arguments (`{text, author?, sourceName, sourceUrl}`)                     |
| `citations[]`                       | which source supplied each field (`{field, sourceName, sourceUrl, tier, official}`) |
| `sources[]`                         | one `Source` per citation, for attribution chips                                    |

The same columns exist on `ContestRecord` (`summaryIsAiGenerated`,
`fiscalImpact`, `citations`) so persisted measures keep their attribution.

## Caching

Enrichment is expensive (network fetches + AI), so results ride along inside the
`civic.getVoterInfo` response, which is cached per-address in `CivicApiCache`
with a 24h TTL. No separate cache table is needed.

## Robustness

Every scraper is **defensive**: network failures, timeouts, and markup changes
yield `null`, never a throw. A missing source is simply "no data from this
tier", and the engine merges whatever it got. Worst case, the app falls back to
the raw Google Civic data exactly as before.

## Extending beyond California

The source-adapter interface (`MeasureSourceData`) is generic. To add a state or
county, write an adapter that returns `MeasureSourceData | null` and register it
in the `Promise.all` in `crossValidateMeasure`. Start with states that publish
structured voter-guide data (e.g. Oregon's ORESTAR). CEDA historical data can be
used to validate extraction accuracy.
