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
CA SOS Official Voter Guide  ─┐
LWV CaVotes (Pros & Cons)    ─┤
Ballotpedia (statewide+local)─┤
Wikipedia (statewide props)  ─┼──▶ Cross-Validation Engine ──▶ Canonical Measure ──▶ Cache (CivicApiCache) ──▶ App
Vote Smart API               ─┤        │ merge by trust tier        │ citation on every field
Google Civic API             ─┤        │ AI structures, never authors
SPUR + AI (grounded fallback)─┘        └── flags discrepancies for review
```

- **Engine:** `packages/api/src/lib/measure-crossvalidate.ts`
- **Source adapters:** `packages/api/src/lib/measure-sources/`
- **Entry point:** `enrichContest()` in `packages/api/src/lib/civic.ts`, run by
  `civic.getVoterInfo`.

## Trust tiers

When more than one source covers the same field, the higher tier wins:

```
county_registrar > state_sos > lwv > ballotpedia > wikipedia > vote_smart > google_civic > ai_generated
```

Defined in `measure-sources/types.ts` (`SOURCE_TIER_RANK`).

## Source adapters

Each adapter fetches over a shared, defensive helper (`measure-sources/fetch.ts`)
that uses a browser User-Agent and turns any failure into `null`.

### CA Secretary of State — Official Voter Guide (`ca-sos-voterguide.ts`)

- **Scope:** California statewide propositions only.
- **Source:** `https://voterguide.sos.ca.gov/propositions/<n>/`
- **Extracts:** official Attorney-General summary, Legislative Analyst (LAO)
  fiscal impact, arguments in favor / against, full-text URL.
- These are **real, official** texts — not AI-generated.
- Matches on the proposition number parsed from the title ("Proposition 36").
- _Note:_ the guide is rebuilt each cycle and only serves the active election,
  so it yields nothing between proposition cycles.

### League of Women Voters — CaVotes (`cavotes.ts`)

- **Scope:** California statewide propositions only.
- **Source:** CaVotes WordPress REST API (`cavotes.org/wp-json/wp/v2/ballots`).
- **Extracts:** nonpartisan "Pros & Cons" summary, fiscal effects, supporter and
  opponent arguments. Real, human-written analysis. Slugs are inconsistent
  across years, so it enumerates the list and matches by prop number + year.

### Ballotpedia (`ballotpedia.ts`)

- **Scope:** **statewide _and_ local** (city / county / special-district)
  measures — the main source for local lettered measures.
- **Source:** rendered article HTML (the MediaWiki API is disabled), resolved
  from a year/county index page since titles aren't constructable.
- **Extracts:** ballot summary / question, fiscal impact / impartial analysis,
  arguments for and against. Year-gated for local measures so a same-letter
  measure from another cycle isn't surfaced.

### Wikipedia (`wikipedia.ts`)

- **Scope:** California statewide propositions only — gated on a parsed
  proposition number (local titles like "Measure Q" collide with unrelated
  articles).
- **Source:** the MediaWiki action API extract for `<year> California
  Proposition <n>`. A neutral encyclopedic overview; carries the article URL.

### Vote Smart (`votesmart.ts`)

- **Scope:** state-level measures. Fuzzy-matches the title to a Vote Smart
  measure and returns summary, full-text URL, pro/con URLs. Requires
  `VOTE_SMART_API_KEY`.

### Google Civic

- The measure as the API returned it — treated as the lowest-trust source so
  its subtitle/text/statements still surface when nothing better exists.

### Grounded AI fallback (`grounded-fallback.ts`)

- **When:** no human/aggregator source had a summary.
- **What:** resolves the measure on SPUR's nonpartisan Bay Area voter guide
  (`spur.org/voter-guide/<YYYY>-<MM>`) by its letter and fetches the real page
  text. That text — never the title alone — is what the AI summarizes. The
  summary is flagged AI-generated and cites the SPUR page it was built from.
- **Pro/con:** SPUR pages carry real "Pros"/"Cons" lists; those are parsed and
  surfaced directly (preferred, cited to SPUR). AI pro/con is generated only
  when no source supplied any.

## AI's role (explicitly scoped)

- **YES** — summarize official fiscal-impact analyses into plain language;
  reconcile and structure existing source text.
- **NO** — invent a summary or arguments when no source material exists (the UI
  shows "No information available" instead). AI pro/con is allowed only as a
  last resort, grounded on fetched source text, when no source had real
  arguments — and is flagged AI-generated.
- **Fallback only** — when there _is_ fetched source text but no human summary,
  an AI summary is generated and **flagged** (`Contest.summaryIsAiGenerated`) so
  the app labels it "AI-generated — not from an official source". The model is
  given the real source text and told to return `INSUFFICIENT` (→ no summary)
  if that text doesn't actually describe the measure, so it can't fabricate
  from a title. Generation goes through the generic `llm` provider
  (`ai-provider.ts`): DeepSeek by default, OpenAI fallback.

## Output shape

`crossValidateMeasure` returns a `CanonicalMeasure`, mapped onto the existing
`Contest` type:

| Field                               | Meaning                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `summary`                           | best available summary (official preferred)                                         |
| `summaryShort` / `summaryLong`      | one-sentence card preview / fuller detail-screen summary                            |
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
