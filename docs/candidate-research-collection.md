# Collecting and reviewing candidate research

The original source adapters cover two complete California races for November 3, 2026. The default CA-17 House collection contains Ro Khanna and Ritesh Tandon. The Lieutenant Governor collection contains Fiona Ma and Gloria Romero. Each collection checks every candidate against the certified roster. These collectors retain refresh ownership until the broader research policy is prepared and adopted. Public availability still depends on current sources and exact reviews.

## Authoritative California catalog

The [California roster adapter](../apps/scraper/src/candidate-research/california-roster.ts) decodes the Secretary of State's Windows-1252 candidate feed and checks membership against the certified candidate document. An immutable snapshot supplies the catalog denominator and each race's complete membership. The November 3 state-certified population contains 388 candidates in 228 races, including 64 judicial retention candidates and four uncontested Assembly races. Propositions are excluded. This source does not enumerate all county, city, school and special-district candidates. The snapshot retains a 58-county coverage ledger so that unenumerated local races stay visible.

The public catalog pages candidates from this snapshot, including candidates whose research is unavailable. Search and office filters apply to the full snapshot before pagination. Candidate detail resolves a canonical election, contest, jurisdiction and candidate identity. A catalog listing establishes ballot identity, not reviewed research. Research remains unavailable until the entire race passes the existing publication gate. Reader requests never start generation.

The requested local extension is San José. Its county roster adapter checks the full Santa Clara County qualified-candidate document, excludes off-ballot contests, and adds qualified write-ins with a distinct status. A reviewed territorial crosswalk selects whole contests serving San José from official jurisdiction evidence. It records source hashes, the selection method, each included, excluded or unresolved contest, and the actual reviewer. Crosswalk explanations are application mapping evidence, not quotations from an election official. A combined snapshot retains incomplete local scope until the unresolved territorial entries have been investigated. Unenumerated counties elsewhere do not block the requested San José scope.

## Bounded statewide reconciliation

The [California worker](../apps/scraper/src/candidate-research/california.ts) exposes `plan`, `reconcile` and `coverage`. Planning retrieves official sources and validates a snapshot. Persistence requires `--apply`. Reconciliation requires an immutable snapshot, explicit policy and write authorization. Verify the selected database host before applying a plan or running reconciliation.

```sh
pnpm --filter @acme/scraper california-research plan
pnpm --filter @acme/scraper california-research plan --apply
pnpm --filter @acme/scraper california-research coverage --snapshot SNAPSHOT_ID
pnpm --filter @acme/scraper california-research reconcile --snapshot SNAPSHOT_ID \
  --policy ca-california-candidate-research-2026-10-30-v2 --apply \
  --max-races 1 --max-candidates 2 --max-source-requests 100 \
  --max-source-bytes 100000000 --max-model-calls 4 \
  --max-input-tokens 200000 --concurrency 1
```

To create the combined scope, provide the reviewed local source manifest with `plan --san-jose-manifest /path/to/manifest.json --apply`. It identifies the official county roster, write-in roster, archived jurisdiction proof sources and reviewed crosswalk. A later refresh retrieves those dependencies again and verifies their hashes before reusing the mapping. Replacing a combined snapshot with state-only scope requires the explicit `--state-scope-only` flag. Do not silently drop local candidates when a county source is unavailable.

Each candidate gets a source-bound evidence dossier. Candidate-specific sources and quoted passages stay separate from generated analysis. Missing evidence has an explicit reason. Retrieval failures do not establish that a candidate lacks a position. Judicial retention research describes the court and retention decision without manufacturing campaign promises. California state and local candidates do not receive federal campaign-finance records.

Author and reviewer calls use the existing structured provider factory. A separate reviewer receives the exact revision and archived evidence. Stored attestations identify each actual invocation, configured and returned model, source and revision digests, prompt version and available usage. A rejected, malformed, stale or self-authored review cannot publish. Separate calls within one model family establish separate invocation contexts, not cross-family review diversity.

Set `CANDIDATE_RESEARCH_REVIEW_MODEL` to select a different model on the configured Responses endpoint for review. The active policy must allow the actual author and reviewer models. Without this setting, review selects the next configured structured model when one exists. Financial values and reader emphasis arrays come from trusted code. The model supplies source-backed prose and evidence selections, while the writer compiles claim and promise IDs from its nested output.

Durable race leases and exact-input artifacts support bounded retries after a crash. Reconciliation prioritizes published races due for refresh. Unchanged, freshly retrieved sources can renew an existing release without another generation call. Changed sources require successor revisions and fresh review. The research library's seven-day query cache does not renew the publication gate's 24-hour freshness requirement. Subscription model cost is unknown when the provider supplies no price; call and token bounds still apply.

The supervisor registers a bounded reconciliation every 30 minutes. The worker requires the selected policy's explicit automation authorization before model work or publication. Deploying code does not adopt that policy or prove the full roster fits the freshness interval. The original pilot jobs retain their races until an explicit ownership transition. Broader policy activation must prepare and re-review replacements for existing live races and cut over atomically. See the [publication policy](candidate-brief-publication.md).

The default source cap is 100 MB. The certified SOS PDF alone is approximately 14.8 MB, and the reviewed San José proof package adds roughly 39 MB before candidate pages. A 50 MB cap cannot admit that shared work. Measure actual request bytes and the complete refresh cycle before treating the 30-minute schedule as sufficient for every race's 24-hour freshness window.

For the one-time policy transition, a trusted operator can pass `reconcile --prepare-policy /path/to/future-policy.json` with the matching `--policy`, `--apply` and explicit bounds. The policy document records `approved: true`, the future `version`, actual `approvedBy`, authorization `statement`, and `automation` model/service constraints. Preparation saves exact reviewed collections without activating the policy or publishing. It preserves a prior release only when its cited dependencies have just been verified unchanged. Pass all prepared replacement collection IDs to the internal `adoptResearchPolicy` transaction after reviewing the actual artifacts. Once the expanded policy is active, scheduled reconciliation owns the pilot races and the legacy collectors stop replacing them.

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

To collect the complete Lieutenant Governor race instead, select its explicit target:

```sh
pnpm --filter @acme/scraper start candidate-research --target ca-lieutenant-governor-2026 --max-items 1 --concurrency 1
```

The statewide collector retains the certified PDF, official candidate identifiers, candidate statements, government office-history records, office responsibilities, and the California Secretary of State's campaign-finance search guidance. It checks specific pledges against each candidate's own statement. Its finance view links to California filings and explicitly marks financial totals, donor identities and outside spending unavailable. The federal FEC adapter does not apply to statewide candidates. A changed roster or selected pledge stops collection for review.

The following command retrieves the same statewide sources and validates a draft without connecting to a database. Keep its output outside version control:

```sh
pnpm --filter @acme/scraper exec tsx src/candidate-research/statewide-entry.ts /tmp/lieutenant-governor-draft.json
```

`FEC_API_KEY` is optional for the CA-17 collection. The API uses it in a header, never source URLs. Without it, the bounded request uses FEC's demo key and may fall back to the public summary. Requests fail promptly on rate limits rather than waiting for a long Retry-After period. The source registry and supervisor jobs contain both adapters; other election and statement scrapers retain their existing behavior.

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

Publisher access (`canPublish: true`) additionally allows an accountable owner to record a versioned publication policy and publish an independently approved complete race. The UI requires the owner's policy statement. An automated test or code review does not supply editorial approval. The [approved pilot policy](candidate-brief-publication.md#approved-policy-for-the-2026-pilot) also permits independent AI content review and trusted operator publication, with explicit actor identities and exact-revision evidence. Revoking the latest policy closes public reads and does not revive an older policy. Policy and release data are read within the same repeatable-read transaction.

A draft app URL uses `/candidate-research?draft=<collection UUID>`. It requires an editor session, is visibly unpublished, and preserves that context through candidate, promise and money navigation. Public users cannot fetch the collection or its source archive. Published URLs use `race=<release UUID>` and work without an editor session.

The older trusted database CLI remains available for operators. Its JSON actor fields are not authenticated and it must never be exposed as an end-user endpoint. Use the authenticated workbench for signed-in editorial decisions. For delegated AI review, use the trusted operator path and identify the AI reviewer explicitly. The owner may be recorded by a verified external account identity; this does not create a Billion login or grant workbench access.

## Verification and limits

[The evidence record](evidence/443-native/README.md) distinguishes real collected drafts, synthetic lifecycle tests, and native fixture captures. Local integration tests exercise authentication, policy permissions, independent review, correction, refresh races, withdrawal and link-preserving renewal:

```sh
CANDIDATE_RESEARCH_TEST_DATABASE_URL=postgresql://localhost:55443/billion_candidate_research pnpm --filter @acme/api exec tsx --test src/lib/candidate-research-store.integration.test.ts
pnpm --filter @acme/scraper exec tsx --test src/candidate-research/sources.test.ts
```

To verify a freshly collected Lieutenant Governor draft through persistence, authenticated test review, publication, guide resolution and withdrawal, use a migrated disposable local database whose name starts with `billion_candidate_` and ends with `_test`. `CANDIDATE_RESEARCH_GUIDE_FILE` accepts a current official-guide payload or its tRPC response. Test policy and reviewer identities remain local and do not approve production publication:

```sh
CANDIDATE_RESEARCH_TEST_DATABASE_URL=postgresql://localhost:55443/billion_candidate_realdata_test \
CANDIDATE_RESEARCH_COLLECTION_FILE=/tmp/lieutenant-governor-draft.json \
CANDIDATE_RESEARCH_GUIDE_FILE=/tmp/california-guide.json \
pnpm --filter @acme/api exec tsx --test src/lib/guide-candidate-research.integration.test.ts
```

Run publication integration files with `--test-concurrency=1` when sharing one local database. They change the database's active publication policy and cannot run concurrently against that shared state.

The integration command only accepts an explicitly local database whose name starts with `billion_candidate_`. It creates and removes synthetic test records; it does not approve the real pilot. Real editorial approval, production deployment and physical-device accessibility acceptance must be recorded separately. This adapter does not collect a comprehensive voting history, every campaign promise, or state/local campaign-finance systems.

## Verify public coverage before calling a release complete

After production editorial review and publication, verify the actual public API for a real candidate. The script requires a released candidate, a current complete-race snapshot, sourced research, a promise, and catalog discovery. It fails for unavailable research and does not publish or generate anything:

```sh
node scripts/verify-candidate-research.mjs --name "Fiona Ma" --office lt-governor --out /tmp/fiona-public-verification.json
```

Use `--base-url` only when deliberately verifying another deployment. Local screenshots with collected data demonstrate rendering, while this check establishes public availability. Neither substitutes for independent content and source review of the exact revisions.
