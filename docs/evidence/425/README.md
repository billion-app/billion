# Issue 425 runtime evidence

Captured from the running Expo web development bundle in this worktree at
390 × 844 CSS pixels. All people, addresses, and contests are synthetic fixtures;
these images are not evidence of provider coverage or production mobile behavior.

- [Race](race.png), [sparse race](sparse.png), and [withdrawn candidate](withdrawn.png)
  use existing detail routes with synthetic North Carolina route parameters.
  Ballot provenance is explicitly named “Synthetic provider fixture”.
- [Journey race](journey-race.png) and [journey candidate](journey-candidate.png)
  follow clicks through the existing `BallotLookupFixture` with a provider-shaped
  `candidate` contest kind, unknown ballot status and separate election name.
- [Provider error](provider-error.png) and [election mismatch](mismatch.png)
  exercise existing controlled lookup scenarios. The mismatch hides stale contests.
- [Guide error](guide-error.png) and [guide null](guide-null.png) use intercepted
  tRPC error/null responses; both provide official guide and election-office links.
- [Web enlargement diagnostic](web-enlargement-diagnostic.png) injects 1.8× font
  and line-height into web text. It exposes clipping at the fixed header and is
  **not** native Dynamic Type evidence or an accessibility pass.

The lookup/guide captures used a temporary route mounting the existing components;
that capture-only route was removed before commit. No database writes or ingestion
were performed. Native Dynamic Type, screen-reader behavior, production provider
ballots and real-reader comprehension remain release gates.
