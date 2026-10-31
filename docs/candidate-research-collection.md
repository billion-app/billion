# Collecting and reviewing candidate research

The original source adapters cover two complete California races for November 3, 2026. The default CA-17 House collection contains Ro Khanna and Ritesh Tandon. The Lieutenant Governor collection contains Fiona Ma and Gloria Romero. Each collection checks every candidate against the certified roster. These collectors retain refresh ownership until the broader research policy is prepared and adopted. Public availability still depends on current sources and exact reviews.

## Authoritative California catalog

The [California roster adapter](../apps/scraper/src/candidate-research/california-roster.ts) decodes the Secretary of State's Windows-1252 candidate feed and checks membership against the certified candidate document. An immutable snapshot supplies the catalog denominator and each race's complete membership. The November 3 state-certified population contains 388 candidates in 228 races, including 64 judicial retention candidates and four uncontested Assembly races. Propositions are excluded. This source does not enumerate all county, city, school and special-district candidates. The snapshot retains a 58-county coverage ledger so that unenumerated local races stay visible.

The public catalog pages candidates from this snapshot, including candidates whose research is unavailable. Search and office filters apply to the full snapshot before pagination. Candidate detail resolves a canonical election, contest, jurisdiction and candidate identity. A catalog listing establishes ballot identity, not reviewed research. Research remains unavailable until the entire race passes the existing publication gate. Reader requests never start generation.

The requested local extension is San José. The county adapter checks the current county-delegated Clarity election definition, settings and XML choice identifiers against an independently reviewed identity crosswalk. The archived qualified-candidate and write-in documents preserve qualification context, including qualified write-ins with a distinct status. They do not receive a new retrieval timestamp when a current source is checked. A reviewed territorial crosswalk selects whole electoral contests serving San José from official jurisdiction evidence. It records source hashes, the selection method, each included, excluded or unresolved contest, and the actual reviewer. Crosswalk explanations are application mapping evidence, not quotations from an election official. A combined snapshot retains incomplete local scope until the unresolved territorial entries have been investigated. Unenumerated counties elsewhere do not block the requested San José scope.

This release covers the November 3, 2026 state-certified roster and the reviewed San José local contests. Other elections and geography, generalized publisher/provider frameworks, new state/local finance ingestion, and post-election promise tracking are deferred in [issue 537](https://github.com/billion-app/billion/issues/537). Missing evidence for a candidate in this election remains a current coverage gap; it does not remove that candidate from the catalog or permit a fabricated brief.

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

To create the combined scope, provide the reviewed local source manifest with `plan --san-jose-manifest /path/to/manifest.json --apply`. It identifies the current county election definition, required fresh jurisdiction proof sources, historical qualification archives and reviewed crosswalks. A later refresh retrieves every required current dependency and verifies its text or raw graphic hash before reusing the mapping. Historical qualification archives remain bound to their original source hashes and retrieval timestamps. They do not replace current roster or territorial proof. Replacing a combined snapshot with state-only scope requires the explicit `--state-scope-only` flag. Do not silently drop local candidates when a county source is unavailable.

Local campaign discovery can follow an exact Website entry from the reviewed historical county filing. The filing supplies an identity and URL bridge, with its original timestamp and record hash. It cannot supply fresh campaign claims. The API rechecks that entry against the stored candidate mapping, and the collector records the actual redirect chain to a freshly retrieved page. An observed, unquoted campaign publisher disclosure is required before treating a linked site as candidate supplied. A campaign publisher can still quote another person, so selected passages must preserve their speaker attribution. Missing websites, inaccessible pages and institutional pages without that attribution remain explicit evidence gaps.

Each candidate gets a source-bound evidence dossier. Candidate-specific sources and quoted passages stay separate from generated analysis. Campaign publication does not establish a passage's speaker. Unresolved campaign material retains the exact bounded surrounding context, and verified official candidate submissions remain distinct. Public source metadata is copied from the immutable dossier; callers cannot strip its uncertainty or upgrade its attribution. A draft containing only gaps stays private and pending. Publication requires a supported candidate-specific Record or Priorities claim, or identity-reconciled substantive finance, for every candidate in the race. The trusted service records that minimal eligibility basis alongside the exact review. Missing evidence has an explicit reason. Retrieval failures do not establish that a candidate lacks a position. Judicial retention research describes the court and retention decision without manufacturing campaign promises. California state and local candidates do not receive federal campaign-finance records.

Author and reviewer calls use the existing structured provider factory. A separate reviewer receives the exact revision and archived evidence. Stored attestations identify each actual invocation, configured and returned model, source and revision digests, prompt version and available usage. A rejected, malformed, stale or self-authored review cannot publish. Separate calls within one model family establish separate invocation contexts, not cross-family review diversity.

The author contract carries evidence origins as well as citation roles. Documented facts require an eligible primary record. Candidate statements can support attributed accounts, but cannot become independently documented facts. The author schema excludes fact claims from chapters without eligible primary evidence, and the compiler still checks the returned references. Mixed primary-record and candidate citations remain possible.

Candidate preparation can make one corrective author attempt after a completed, retained schema-validation failure, a supported dossier whose compiled brief contains no substantive research, or an actionable independent-review rejection. The correction includes the actual failed output or compiled brief and its validation problems or reviewer findings. A valid but empty brief gets evidence-bound feedback; ambiguous speakers and third-party pledges still cannot establish candidate adoption, and the correction may honestly remain empty. It is a new model invocation, followed by independent review of the exact replacement revision. An immutable correction slot binds that attempt to the original author input. Restarting, reclaiming a lease, or changing the review epoch cannot create more correction attempts. A reserved invocation with an unknown outcome stays blocked. Every corrective call and its full prompt count against the existing run limits. Exhausted corrections remain visible as blocked research rather than being approved or retried indefinitely.

Campaign publisher disclosures are extracted with HTML block boundaries intact. A verified filing link and legal publisher disclosure establish a campaign identity bridge, while speaker attribution remains separate. Current House records can qualify without future-election wording only through the closed institutional profile rule, matching the official host, full name, office and California district. A record for another office still needs its own identity bridge. County education-board authority is matched independently from county jurisdiction, so the county roster's office order does not confuse it with the state Board of Equalization.

A required-source failure records the actual attempted timestamp and collected provenance in the same transaction that invalidates the race and fences its lease. The next bounded run can rotate past that failed attempt. A stale worker cannot save the checkpoint after invalidation, reserve another model call, or publish under the old review epoch.

Set `CANDIDATE_RESEARCH_REVIEW_MODEL` to select a different model on the configured Responses endpoint for review. The active policy must allow the actual author and reviewer models. Without this setting, review selects the next configured structured model when one exists. Financial values and reader emphasis arrays come from trusted code. Verified finance can support a finance-only profile with no prose headline or promise readings. The compiler retains that typed data without inventing a claim or headline ID. A reported zero is distinct from absent data; empty outside-spending data alone needs complete coverage. The model supplies source-backed prose and evidence selections, while the writer compiles claim and promise IDs from its nested output.

Adding an approved projection changes the immutable snapshot identity even when candidate membership and race digests stay the same. Preserve the previous snapshot, original source bodies and existing approval receipts. Record the new source-specific review with its actual actor, timestamp, evidence-bundle hash and canonical digest. Upgrade full-roster readers before saving a snapshot that uses a new projection ID. Saving the forward snapshot advances invalidation epochs; normal reconciliation must establish a new source check and obtain any required fresh candidate reviews under those epochs. A pre-transition observation or an old model invocation must not be relabeled as a new review.

Durable race leases and exact-input artifacts support bounded retries after a crash. Reconciliation prioritizes published races due for refresh. Unchanged, freshly retrieved sources can renew an existing release without another generation call. Changed sources require successor revisions and fresh review. Equivalent roster refreshes preserve semantic snapshot and membership digests. The existing Clarity identity protocol checks office and membership independently of permitted tally/report changes. Three separately reviewed authority projections ignore only the specified CDE view counters, seven MVLA asset-version values, and three related-dataset harvest UUIDs on the California school-district catalogue page. The primary dataset and every other byte of that catalogue page remain binding. Harvest IDs are provenance facts; their original and observed raw archives are retained even though this exact change does not alter territorial evidence. Authority text, map links, identity metadata and geographic proofs remain binding. Original reviews and roster documents stay immutable. Fresh raw hashes, retrieval timestamps, projection receipts and content-addressed source bodies are stored as separate private observations. Stable roster identity does not waive the exact cited-source gate. A changed full Clarity response cited by a candidate dossier can still require new candidate research and review, even when its membership projection is equivalent. The research library's one-day discovery cache and seven-day document cache do not renew the publication gate's 24-hour freshness requirement. Expiry follows the oldest actual current source or required roster observation. Cached bodies keep their original retrieval times; a genuine unchanged retrieval can renew the mutable observation bound without rewriting approved text. Historical document dates and identity bridges do not act as fresh substantive observations. Subscription model cost is unknown when the provider supplies no price; call and token bounds still apply.

The supervisor registers a bounded reconciliation every 30 minutes. The worker requires the selected policy's explicit automation authorization before model work or publication. Deploying code does not adopt that policy or prove the full roster fits the freshness interval. The original pilot jobs retain their races until an explicit ownership transition. Broader policy activation must prepare and re-review replacements for existing live races and cut over atomically. See the [publication policy](candidate-brief-publication.md).

The default source cap is 100 MB. The certified SOS PDF alone is approximately 14.8 MB, and the reviewed San José proof package adds roughly 39 MB before candidate pages. A 50 MB cap cannot admit that shared work. Measure actual request bytes and the complete refresh cycle before treating the 30-minute schedule as sufficient for every race's 24-hour freshness window.

For the one-time policy transition, a trusted operator can pass `reconcile --prepare-policy /path/to/future-policy.json` with the matching `--policy`, `--apply` and explicit bounds. The policy document records `approved: true`, the future `version`, actual `approvedBy`, authorization `statement`, and `automation` model/service constraints. Preparation saves exact reviewed collections without activating the policy or publishing. It preserves a prior release only when its cited dependencies have just been verified unchanged. Pass all prepared replacement collection IDs to the internal `adoptResearchPolicy` transaction after reviewing the actual artifacts. Once the expanded policy is active, scheduled reconciliation owns the pilot races and the legacy collectors stop replacing them.

## Original pilot collectors

The [collector](../apps/scraper/src/candidate-research/collect.ts) checks California's certified PDF against its official candidate-ID feed, and verifies the campaign contact list. A changed roster stops collection until identity mappings are reviewed. FEC IDs are checked against name, office, state and district; names are not application identifiers.

For each candidate it retains a directly retrieved position source, House legislative-process guidance, and FEC financial sources. Original text, URL, retrieval time and SHA-256 hash are stored separately from the explanation. Selected promises must match exact source passages. Explanations are deterministic, Codex-assisted draft templates, not published findings or a complete platform assessment. No model call runs during collection or reading.

FEC processed totals must reconcile in integer cents. The API path excludes memo entries, rejects conflicting transaction IDs, checks committee ownership and reporting dates, and displays at most 20 contribution records and 20 independent expenditures per candidate. A contribution row is **one payment**, not a donor's aggregate giving. Refunds and candidate loans are separate. This adapter consumes FEC's processed records; it does not independently reconcile raw filing amendments.

When the API is unavailable or rate-limited, the collector verifies and reconciles the FEC public candidate summary instead. Missing columns or wrong identities fail validation. This fallback explicitly marks named donors and outside spending unavailable; it never substitutes zero. Lobbying roles, interests and donor positions require separately cited editorial work and are not inferred from names or employers. An API key improves access to itemized records but does not guarantee completeness.

The California worker first reconciles federal identities against the bounded FEC API candidate index. An HTTP 429 selects the official current-cycle candidate master ZIP instead. Its complete original text, official URL, retrieval time, content hash and archive-byte hash remain in the dossier. One pure identity matcher serves collection, dossier validation and publication qualification. It requires a unique exact full-name, House office, California district and election-year match; the master does not establish ballot eligibility or contain financial totals. API no-match, malformed data and exhausted run budgets do not select this fallback. The ZIP has separate compressed and inflated bounds, and each dossier retains the existing 2 MB aggregate source limit. The existing public candidate summary supplies partial finance; unavailable named donors and outside spending remain unknown.

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

## California roster storage

The roster store accepts and returns the complete immutable roster, including exact source text and image bytes. Its private `archive-refs-v1` JSONB representation stores repeated current source bodies in the existing content-addressed research artifacts. It retains source metadata, races, identity crosswalks, renewal proofs and historical contact evidence at their existing SQL paths. Public catalog queries read that metadata without loading or hydrating the full source bundle.

`saveCaliforniaRoster` writes and verifies the required immutable archives inside the same transaction before inserting the stored manifest or changing the current pointer. `getCaliforniaRoster` resolves references, verifies artifact kind, content address, text hash and available binary hash, then parses the original domain schema. Missing or corrupt archives fail closed. Legacy inline rows remain readable, and saving an existing snapshot ID preserves its first stored document. This representation does not create a new snapshot identity, renew source timestamps, or change sealed candidate revisions.

The stored manifest is limited to 4 MiB of serialized JSON and each referenced archive to 6 MiB. These are admission limits based on the November fixture, not a database memory guarantee. No migration or new archive table is needed. The isolated fixture test requires an explicitly selected disposable database and an unchanged full roster file:

```sh
CANDIDATE_RESEARCH_TEST_DATABASE_URL=postgresql://roster_test:roster_test@127.0.0.1:55464/roster_storage_test \
CALIFORNIA_STORAGE_FIXTURE_PATH=/absolute/path/to/approved-full-roster.json \
pnpm --filter @acme/api exec tsx --test --test-concurrency=1 src/lib/california-roster-storage.integration.test.ts
```

The test checks exact hydration, public and contact SQL projections, legacy reads, archive corruption, transactional rollback and immutable-ID reuse. It makes no source or model requests and removes its test records. Apply committed migrations to that isolated database before running it.
