# Collecting and reviewing candidate research

The first source adapter covers **California's 17th Congressional District, November 3, 2026**. It collects every candidate on that certified roster: Ro Khanna and Ritesh Tandon. This is a bounded research pilot, not an address-to-ballot lookup or nationwide coverage.

## Source to reader

The [collector](../apps/scraper/src/candidate-research/collect.ts) checks California's certified PDF against its official candidate-ID feed, and verifies the campaign contact list. A changed roster stops collection until identity mappings are reviewed. FEC IDs are checked against name, office, state and district; names are not application identifiers.

For each candidate it retains a directly retrieved position source, House legislative-process guidance, and FEC financial sources. Original text, URL, retrieval time and SHA-256 hash are stored separately from the explanation. Selected promises must match exact source passages. Explanations are deterministic, Codex-assisted draft templates, not published findings or a complete platform assessment. No model call runs during collection or reading.

FEC processed totals must reconcile in integer cents. The API path excludes memo entries, rejects conflicting transaction IDs, checks committee ownership and reporting dates, and displays at most 20 contribution records and 20 independent expenditures per candidate. A contribution row is **one payment**, not a donor's aggregate giving. Refunds and candidate loans are separate. This adapter consumes FEC's processed records; it does not independently reconcile raw filing amendments.

When the API is unavailable or rate-limited, the collector verifies and reconciles the FEC public candidate summary instead. Missing columns or wrong identities fail validation. This fallback explicitly marks named donors and outside spending unavailable; it never substitutes zero. Lobbying roles, interests and donor positions require separately cited editorial work and are not inferred from names or employers. An API key improves access to itemized records but does not guarantee completeness.

The [collection store](../packages/api/src/lib/candidate-research-store.ts) verifies hashes and freshness before persistence. Changed source content or coverage invalidates the entire published race and creates new draft revisions. A failed refresh withdraws publication. Recovery requires new review. An unchanged successful refresh preserves corrected editorial text, approvals and the release URL, and renews only the freshness metadata after rechecking the exact approved revisions. Source freshness expires after 24 hours. The supervisor configuration schedules a refresh every 12 hours; deploying that job is a separate operations step.

## Run one collection

Verify the selected database host and database name first; root `.env.local` can override `.env`. Apply committed migrations through [the migration workflow](data-layer.md#migrations). Migration `0025_tranquil_ego.sql` adds collected sources, editor roles and versioned policy decisions. It follows the release table in `0024_blushing_sharon_ventura.sql`.

```sh
# Exactly one complete race; no paid generation.
pnpm --filter @acme/scraper start candidate-research --max-items 1 --concurrency 1
```

`FEC_API_KEY` is optional. The API uses it in a header, never source URLs. Without it, the bounded request uses FEC's demo key and may fall back to the public summary. Requests fail promptly on rate limits rather than waiting for a long Retry-After period. The source registry and supervisor job contain this adapter; other election and statement scrapers retain their existing behavior.

## Authenticated editorial workflow

Open `/editor/candidate-research` in the Next.js app and sign in through the existing authentication flow. An operator must provision that existing account. Put the following fields in a local JSON file, using actual account and operator IDs:

```json
{
  "userId": "existing-account-id",
  "canPublish": false,
  "grantedBy": "accountable-operator-id"
}
```

```sh
# Validate without writes, then grant against the verified database.
pnpm --filter @acme/api candidate-research grant-editor /path/to/editor.json
pnpm --filter @acme/api candidate-research grant-editor /path/to/editor.json --write
# Revocation uses the same document and requires --write.
pnpm --filter @acme/api candidate-research revoke-editor /path/to/editor.json --write
```

Editors can inspect sources, preview the exact draft in the native reader, edit a structured revision, and approve or withdraw it with a reason. Editing creates a successor and withdraws any published race. The author cannot approve their own revision. These actions use the signed-in account ID; clients cannot supply the reviewer identity. Source URLs, quotes and hashes must continue to match the collected source set.

Publisher access (`canPublish: true`) additionally allows an accountable owner to record a versioned publication policy and publish an independently approved complete race. The UI requires the owner's policy statement; an automated test or code review does not supply editorial approval. Revoking the latest policy closes public reads and does not revive an older policy. Policy and release data are read within the same repeatable-read transaction.

A draft app URL uses `/candidate-research?draft=<collection UUID>`. It requires an editor session, is visibly unpublished, and preserves that context through candidate, promise and money navigation. Public users cannot fetch the collection or its source archive. Published URLs use `race=<release UUID>` and work without an editor session.

The older trusted database CLI remains available for operators. Its JSON actor fields are not authenticated and it must never be exposed as an end-user endpoint. Prefer the authenticated workbench for editorial decisions.

## Verification and limits

[The evidence record](evidence/443-native/README.md) distinguishes real collected drafts, synthetic lifecycle tests, and native fixture captures. Local integration tests exercise authentication, policy permissions, independent review, correction, refresh races, withdrawal and link-preserving renewal:

```sh
CANDIDATE_RESEARCH_TEST_DATABASE_URL=postgresql://localhost:55443/billion_candidate_research pnpm --filter @acme/api exec tsx --test src/lib/candidate-research-store.integration.test.ts
pnpm --filter @acme/scraper exec tsx --test src/candidate-research/sources.test.ts
```

The integration command only accepts an explicitly local database whose name starts with `billion_candidate_`. It creates and removes synthetic test records; it does not approve the real pilot. Real editorial approval, production deployment and physical-device accessibility acceptance must be recorded separately. This adapter does not collect a comprehensive voting history, every campaign promise, or state/local campaign-finance systems.
