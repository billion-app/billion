# Issue #332: ballot coverage evidence

This directory measures the base Google Civic response independently of Billion's
cache and enrichment. The existing [civic read path](../../packages/api/src/lib/civic.ts)
can enrich contests and write cache entries, so the harness calls the provider
directly. It imports no application code, touches no database, and invokes no
Places, AI, or paid replacement service. See [issue #332](https://github.com/billion-app/billion/issues/332).

## Run a bounded sample

Use Node 22.20 or newer. No package install is needed.

```sh
node --test tools/issue-332/coverage.test.mjs
node tools/issue-332/probe.mjs
node tools/issue-332/coverage.mjs > /tmp/coverage.json
```

The endpoint probe makes one GET to `/elections`, distinguishing missing credentials,
provider-reported invalid keys and API access configuration errors without logging
provider messages. Other failures remain provider errors. Run it before sampling.

The checked-in sample plan has 15 states and several jurisdiction types. Its
addresses are deliberately empty: none has been verified as a suitable residential
sample. Copy `samples.json` outside the repository, fill in consented test addresses
and retain stable sample IDs. Record address provenance privately. A city hall,
postal box or arbitrary landmark cannot establish residential ballot coverage.
Keep the private sample file for reproducibility; do not commit residential addresses.

Inject `GOOGLE_CIVIC_API_KEY` through your existing secret manager or process
environment, then run:

```sh
node tools/issue-332/coverage.mjs /absolute/private/samples.json > /tmp/coverage.json
```

The harness uses only the process environment and does not load local files.
For repository environment loading, use the existing
[shared loader](../../packages/env/src/load.ts), following the
[loading policy](../../docs/launch.md#loading-policy); never paste keys into commands
or committed files. The fixed target is `www.googleapis.com/civicinfo/v2/voterinfo`.
There are at most 30 sequential GET requests per invocation, one per sample, a
15-second timeout each, no retries, and no redirect following. Exit 2 means at
least one row was unmeasured or a provider error; exit 1 means invalid run input.
Exit 0 does **not** mean release readiness or complete coverage.

Start with `electionId: null` to discover address-specific elections. Review the
returned election and `otherElections`. Where a choice is needed, rerun the affected
sample with an explicit returned ID. Budget that second run separately. Never use
the first global election as every address's election; never silently replace an
explicit selection. The harness flags mismatched response IDs as provider errors.
It conservatively asks for selection whenever an unselected response has alternatives.

The output keeps observation time, requested and returned election IDs, alternatives,
HTTP status, field presence and counts, and `mailOnly` when explicitly supplied.
Raw responses, keys, street addresses, provider error messages and generated text
are excluded. HTTP 400 is deliberately an error, because it does not distinguish
invalid address from unknown election. Inspect provider diagnostics privately before
assigning a more specific state. Counts establish presence, not correctness.

## Complete the official comparison

For each address and selected election, manually open the relevant state/local
election office's sample-ballot service. Use [USA.gov's election office directory](https://www.usa.gov/state-election-office)
as a starting point. Do not bypass voter authentication or submit registration.
Record a separate comparison row with:

- sample ID, reviewer, UTC check time, selected election ID and election date;
- exact official URL, jurisdiction/precinct and document title/version;
- candidate races and measures: match, mismatch, or unavailable for comparison;
- polling, early-vote and drop-off fields: match, mismatch, or not applicable only
  when the official source establishes that distinction;
- discrepancies and a short factual supporting excerpt or document reference;
- any publication claim with the exact official source supporting that claim.

A portal requiring voter identity, inaccessible page, empty provider result or
missing field is an unresolved comparison. It cannot establish that a ballot is
unpublished or that an election does not exist. Keep official source evidence
separate from enrichment results. This harness always marks enrichment `not_run`
and official comparison `pending`; reviewed comparisons live alongside its output.

## Safe UI state handoff for #329 and #330

These are evidence rules, not changes to shared application types.

| State                               | Evidence                                                           | User-facing behavior                                                                      |
| ----------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `data_available`                    | Selected response has contests                                     | Show sourced entries; never label them a complete ballot without comparison.              |
| `election_selection_required`       | Unselected response includes alternatives                          | Show address-specific election choices and query the chosen ID.                           |
| `election_known_ballot_unavailable` | Selected election exists, contests absent/empty                    | Show election identity and official lookup link; say ballot details are unavailable here. |
| `no_data_found`                     | Successful response has neither election nor contests              | Say no data was found for this lookup; offer official lookup.                             |
| `invalid_input`                     | Local input validation or verified provider-specific address error | Ask the voter to check the address; do not infer from all HTTP 400s.                      |
| `provider_error`                    | HTTP, timeout, parse, error envelope or ID mismatch                | Show retry and official fallback; never present as absent election.                       |
| `not_measured`                      | Missing key or unprepared test sample                              | Research-only state; no coverage claim.                                                   |

“Not yet published” and publication dates require a dated official statement.
Registration, mail and receipt deadlines must be directly sourced; no date arithmetic.
Missing enrichment does not erase available provider contests.

## Weekly repeat through rollout

The release coordinator should run this procedure weekly, retaining dated JSON and
reviewed comparisons, using the same private samples and selected election IDs.
Check alternatives again as election availability changes. Add representative
addresses when claiming another precinct or jurisdiction; one address does not
validate a state. Diff field counts, election identity and official discrepancies,
then refresh the go/no-go decision. No scheduled job was installed by this change.
The first credentialed run and continuing weekly observations remain acceptance work.

## Current decision and integration boundaries

See the [dated report](evidence/2026-09-15.md). No national ballot rollout is supported
by current evidence. The only supported use is internal research and verification;
no state or jurisdiction is certified by this sample plan. Keep `electionsAreLive`
disabled. #337 owns the launch decision; #329/#330 own application integration,
#335 owns read-path behavior, and #331 owns logistics presentation. This directory
requires no sibling branch. Elections tab, navigation, autocomplete, #272 content,
and provider migration remain with their assigned owners.
