# Candidate research reader

The native reader follows a candidate from a race roster into a brief, individual
campaign promises, campaign finance, and source passages. Elections → Candidate
research opens the catalog. A race is a reviewed candidate list, not an
address-matched ballot; the reader must still confirm it against the official ballot.

## Reading and evidence

The [reader](../apps/expo/src/components/candidate-research/ResearchScreen.tsx)
uses `/candidate-research?race=<release UUID>&person=<candidate ID>`. The `tab`
parameter selects `brief`, `money`, or `sources`. A promise has its own stack
entry, `/candidate-promise`, with the same race/person and a `promise` claim ID;
`read=analysis` selects its deeper explanation. Links and reloads retain identity.
Comparison includes every roster member, including withdrawals and evidence gaps.

A recorded action uses a document/timeline treatment. A campaign promise uses a
separate card. Interpretation is attributed to Billion and labeled AI-assisted
when appropriate. The promise's short reading explains the proposal, authority,
and unresolved requirements; the deeper reading places potential benefits and
costs together, then affected people, perspectives, decisions, alternatives, and
unknowns. All substantive points reference evidence in the reviewed revision.

Evidence opens in a native modal sheet with a persistent Done control, separate
scroll area, drag dismissal, original passage, locator, and source URL. The
reviewed explanation of what a source establishes is separate from its quotation.
Text emphasis is exact, limited to four phrases per point, and covered by review.

Finance separates donor **type**, a documented **lobbying role**, and documented
**interest areas**. Unknown interests remain explicit. Positions belong in donor
details with sources. Colors are navigation aids, not a judgment or party label.
No category is inferred from a person's name, religion, or nationality. Amounts
use integer cents and primary-record citations; receipts reconcile to their
breakdown. Candidate loans and contributions are separate, refunds are outflows,
and outside support/opposition spending is never added to campaign receipts.
The data describes reviewed reporting periods, not lifetime totals or a claim of
influence. Unavailable amounts remain unavailable rather than becoming zero.

## Published data path

The optional `research` fields extend the existing
[candidate brief schema](../packages/validators/src/candidate-brief.ts) without
changing old revision digests. Promise details and finance use the
[research contracts](../packages/validators/src/candidate-research.ts). The entire
revision, including classification, emphasis, sources, and limitations, is bound
to the independent editor's approval digest.

The [race reader](../packages/api/src/lib/candidate-race-release.ts) validates a
versioned official roster manifest, exact member/revision mapping, approved
policy version, independent approvals, current source hashes, and withdrawals.
Source checks expire in at most 24 hours. The
[store](../packages/api/src/lib/candidate-race-store.ts) inserts a full-race
snapshot only after those checks. Source changes or fetch failures must revoke
that snapshot before rereview. An unchanged successful source check retains the release URL and renews freshness
only after validating the exact approved revisions. Changed evidence requires new review.

The [tRPC procedures](../packages/api/src/router/candidate-briefs.ts) recheck the
whole race in a repeatable-read transaction. A revoked, expired, or incomplete
successor cannot revive an older snapshot. The catalog returns up to 100 current
races; the exact-ID lookup ranks snapshots before filtering so repeated releases
do not evict another race. Mobile polls while open and removes an expired result
locally. There is no provider lookup, paid generation, or publication write on a
reader request. Expo imports API types and calls tRPC, never the database client.

## Collected drafts and publication

The [CA-17 source adapter and authenticated workbench](candidate-research-collection.md)
now collect a complete certified pilot roster, candidate positions, office powers,
and reconciled FEC finances. Real data remains a visibly unpublished draft until
independent editorial approval. Source refresh and revocation are implemented;
the supervisor job must be deployed to run them in production.

Publication defaults to **unapproved**. The server reads the latest persisted
policy decision before looking up releases, within the same transaction. Only a
provisioned publisher can approve or revoke policy through the authenticated API.
Development fictional examples remain gated by `__DEV__`; production URL
parameters cannot enable them. Draft previews require an editor session.

The pilot does not provide comprehensive candidate histories, automatic interest
classification, nationwide matching or local finance ingestion. Physical-device
VoiceOver and real-reader acceptance remain release checks. No fictional records
are production seeds and no real editorial approval was performed during development.

## Trusted operator workflow

Apply migration `0024_blushing_sharon_ventura.sql` through the normal
[migration procedure](data-layer.md#migrations) before activating the API. It adds
the release snapshot table; `0025_tranquil_ego.sql` adds the collection and editorial tables. No shared database was migrated during development.

The CLI is for trusted server operators with database access; it is not an
editorial authorization API. It does not prove the identity of an actor supplied
in JSON, so do not expose it to end users. Follow
[candidate publication policy](candidate-brief-publication.md) before any approval.

```sh
# Schema validation only; does not access the database.
pnpm --filter @acme/api candidate-research draft /path/to/brief.json
pnpm --filter @acme/api candidate-research release /path/to/manifest.json
```

After verifying the selected database host (root `.env.local` can override `.env`),
append `--write` to stage a draft, append a review event, create a race release, or
revoke it. The command prints host, port, and database without credentials. A
release write refuses to proceed while policy is unapproved. Review JSON contains
`revisionId`, `actorId`, `action` (`approve`/`withdraw`), `policyVersion`, and
`reason`. Revoke JSON contains `releaseId` and `reason`. Corrections use successor
revisions and fresh independent approvals; old approvals cannot carry over.

## Verification

[Evidence and run instructions](evidence/443-native/README.md) distinguish native
and web captures from fixtures, integration checks, and remaining human gates.
