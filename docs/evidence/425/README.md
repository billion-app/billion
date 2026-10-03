# Issue 425 runtime evidence

Captured from the running Expo web development bundle in this worktree at
390 × 844 CSS pixels. All people, statements, addresses, and contests are
synthetic; these images do not establish provider coverage or production mobile
behavior. The design follow-up was reviewed through three rounds by the same
fresh independent gpt-6-astra reviewer after an initial screenshot-only critique.

## Finished screens

- [Race](race.png), [sparse race](sparse.png), [withdrawn candidate](withdrawn.png)
  and [sparse candidate](candidate-sparse.png) show compact election context,
  consequential status, honest limits and useful election-office actions.
- [Candidate with statement](candidate-populated.png) shows a short supplied
  statement completely. [Long excerpt](statement-excerpt.png),
  [expanded statement](statement-expanded.png), [bottom of statement](statement-bottom.png)
  and [collapsed again](statement-collapsed.png) verify continuous typography,
  unchanged source text and a working expansion/scroll/collapse round trip.
- [Source disclosure](candidate-sources.png) retains provider retrieval versus
  unavailable human review and field-specific evidence without dominating reading.
- [Lookup](lookup.png), [journey race](journey-race.png) and
  [journey candidate](journey-candidate.png) follow actual clicks through the
  existing `BallotLookupFixture`, using the provider-shaped `candidate` contest
  kind and separate election name. Fictional-data labels remain visible.
- [Provider error](provider-error.png), [election mismatch](mismatch.png),
  [guide error](guide-error.png) and [guide null](guide-null.png) retain recovery
  actions. Guide responses are intercepted tRPC error/null fixtures.

## Review and limits

Astra initially found caveat walls, quiet withdrawal status, repeated absent
sections, misleading link promises and a fragmented statement-reading experience.
The revisions prioritize content, consolidate routine provenance, preserve visible
eligibility limits, use destination-accurate links and retain complete short text.
The final assessment was that the screens themselves impress as a polished,
restrained Billion reading experience: typographic identity is intentional, the
candidate's words are the payoff, and sparse recovery becomes primary only when
content is absent. The reviewer inspected the full expansion/collapse round trip
and requested no further meaningful presentation change.

[Web enlargement diagnostic](web-enlargement-diagnostic.png) injects 1.8× text and
line-height. It exposes fixed-header clipping and is **not** native Dynamic Type
proof or an accessibility pass. Capture-only routes mounting the existing
components were removed before commit. Existing Expo-web authentication CORS
errors remain outside this change; no database writes or ingestion occurred.

Native large text and screen readers, production provider ballots, real coverage,
editorial requirements and unfamiliar-reader comprehension remain separate gates.
The positive Astra design assessment does not replace them.

## Status icon refinement

A fresh screenshot-first Astra review found that the listed, withdrawn and unknown
labels required reading every sentence to distinguish them. The revised race and
candidate captures above use neutral document, circle-minus and question-mark
icons beside explicit text. Withdrawal's source explanation remains subordinate.
Decorative icons are hidden from assistive technology; text carries the meaning.
The reviewer found the revised race list easier to scan and the candidate screens
consistent and polished, with no further material visual change needed. Journey,
provider, mismatch and guide captures retain the preceding review's evidence;
those flows were unchanged by this status refinement.
