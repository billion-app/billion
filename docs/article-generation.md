# Article Generation

How a scraped bill becomes something a person will actually read.

## The problem with the old article

The original pipeline produced one markdown blob per content item — four `##`
sections (What This Means For You / Overview / Impact & Implications / The
Debate), roughly 700–1000 words, rendered as-is in the app.

The prose itself was fine. The prompt was careful about nonpartisan framing,
about not treating sponsor claims as results, about naming removed oversight
rather than calling it "streamlining". The problem was structural:

- **It's a wall.** The reader gets one decision — read all of it, or none of
  it. Nothing is scannable, so the scroll bar does the persuading.
- **Everything looks equally important.** A $200B authorization, a definition,
  and a hedge about uncertainty all render as body paragraphs.
- **Provenance is prose-shaped.** The article could quote the source, but a
  quote is just italic text; nothing checked it was real, and nothing linked it
  back to a section.
- **It can't be reused.** The blob can't fill a card, a stat tile, a
  notification, or — eventually — a video storyboard. Every downstream surface
  has to re-parse English.

This violates the Bradbury Principle in the most ordinary way: a reader who
bounces off paragraph two leaves with nothing, not even curiosity.

## The brief

A **brief** is the same analysis stored as typed pieces instead of prose. The
canonical shape lives in [`@acme/validators`](../packages/validators/src/bill-brief.ts):

| Field          | What it is                                      | Why it's its own field                                                       |
| -------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `hook`         | One sentence naming the biggest concrete change | The floor: a reader who reads nothing else still learns one true thing       |
| `facts`        | ≤4 figures — money, deadlines, scope            | Scannable without reading                                                    |
| `changes`      | ≤5 provisions as `before` → `after`             | Forces current law to be stated separately from the proposal                 |
| `affected`     | ≤4 groups with a `direction`                    | "Who does this land on" is the question people actually have                 |
| `unknowns`     | 1–3 things the text does not settle             | Required, so the brief can't read as more settled than the source            |
| `terms`        | ≤5 glossary entries                             | Jargon gets defined instead of avoided                                       |
| `whyNotBefore` | Optional cited historical context               | Answers the obvious follow-up without guessing at motives                    |
| `deepDive`     | One optional long-form markdown article         | Lets an interested reader keep reading without turning the brief into a wall |
| `reading`      | ≤4 researched outside articles                  | Follows the Bradbury Principle with real next steps                          |

The reader can stop after the hook, after the tiles, after the changes, or go
all the way into the source text — and every stopping point is coherent.

### What the types enforce

Editorial guarantees are encoded in the schema rather than trusted to a prompt:

- **`kind` is mechanical, never evaluative.** `creates` / `repeals` / `expands`
  / `restricts` / `requires` / `waives` / `funds` / `transfers`. A brief can say
  what a provision _does_; it has no vocabulary for saying whether that is good.
  Adding an evaluative member here would break the guarantee.
- **`before` / `after` splits current law from the change.** That blur is where
  accessible summaries usually go wrong — describing a proposal as if it were
  already the state of the world.
- **`direction` tops out at `mixed` / `unclear`.** The model can decline to
  score a group instead of inventing a counterweight to balance the list.
- **`unknowns` is non-empty.** There is no valid brief that claims to have
  settled everything.
- **Legal status is derived, not generated.** `deriveLegalStatus()` reads the
  scraped bill status, so whether the UI says a measure _would_ or _does_ change
  things comes from a string match rather than an inference.

### Where the debate lives

Briefs describe mechanism. They deliberately contain no "supporters say /
critics say" section — that stays in the existing cited **dual-lens**
(`ContentLens`), which does real web research and attaches per-point citations
to sources on both sides. Keeping them separate means the factual layer can't
drift into argument, and the argument layer keeps its own provenance.

## The pipeline

`generateBillBrief()` in
[`apps/scraper/src/utils/ai/bill-brief.ts`](../apps/scraper/src/utils/ai/bill-brief.ts)
has a research pass, a structured writing pass, and deterministic verification.

### 1. Research history and deeper reading (agentic LLM loop)

The model first investigates why the policy has not already been adopted:
earlier bills, documented disagreements, legal or budget limits, implementation
tradeoffs, and changed circumstances. It separately searches for useful
follow-up reading, opens at least three promising pages, and records only
successfully opened URLs. Snippets are never treated as evidence.

### 2. Structure (LLM)

One schema-validated call (AI SDK `Output.object`) grounded in the official
text plus, when available, the existing long-form article. That article already
did the careful nonpartisan reading, so this pass is mostly restructuring —
cheaper and more consistent than reading the statute cold. The model sees a
24k-character window of source text plus the verified research. It may produce
an expandable `whyNotBefore` explanation, but only with citations to opened
pages, and may also write one focused `deepDive` article for readers who opt
into more depth.

### 3. Verify quotes and research links (deterministic)

Every `quote.text` is checked against the **whole** source document, not just
the window the model saw. Matching normalizes away formatting — casing, smart
quotes, em dashes, hyphenation across line breaks, and the erratic whitespace
of scraped legislative text — while staying strict about words, so a dropped or
reordered word still fails.

Unverified quotes are **stripped, and the surrounding claim is kept**. A brief
may end up saying less than the model wrote, but it never puts words in a
bill's mouth. The kept count is stored as `verifiedQuotes`. Outside reading
links are checked against the URLs opened by the research loop; invented links
are dropped. The historical-context section is removed entirely unless at least
two distinct opened sources remain after verification.

### 4. Lint framing and jargon (deterministic)

Loaded political vocabulary — `common sense`, `radical`, `landmark`,
`burdensome`, `handout`, `job-killing`, `red tape`, `power grab` — is matched
against the model's **own prose only**. A hit triggers one regeneration with the
offending phrases named; a second hit is logged and shipped, since a single
colored word is a smaller failure than no brief at all.

Quotes are exempt on purpose. A sponsor is free to call their own bill "common
sense", and reproducing that verbatim is reporting. We just don't say it in our
voice.

## Storage

`content_brief`, one row per content item, keyed on `(contentType, contentId)`
and cached against the source's `contentHash` — the same contract as
`content_lens`. Unchanged content never re-pays for an LLM call. Briefs live
outside the content tables so they can be regenerated, versioned, or dropped
without touching scraped rows.

`BILL_BRIEF_VERSION` gates generation and cache reuse. The scraper reuses only
records that match the current schema, so older rows are regenerated when it
encounters them. The API separately accepts shipped v1 and v5 records and
normalizes them into the current client shape (including affected-group
takeaways and an empty reading list where needed). Invalid or unknown shapes
are still dropped, so the client can treat every present brief as renderable.

## Rendering

[`apps/expo/src/components/ui/BillBrief.tsx`](../apps/expo/src/components/ui/BillBrief.tsx)
renders each block as the UI element it actually is: tiles for facts, before →
after rows for changes, a source-linking quote disclosure, a glossary, and a
`Keep reading` layer. Billion's own deep dive opens as a long-form article
sheet; researched outside articles open with their original publishers.

Two brand constraints shape it:

- **Nothing color-codes a verdict.** A group that "loses" access is drawn
  exactly like one that "gains" it — direction is carried by an arrow and a
  word, never by green/red. Coloring outcomes reads as an editorial position,
  and red-vs-green sits one step from red-vs-blue.
- **Every claim keeps a path back to the source.** Change cards expose the
  verbatim provision behind them; the screen still ends by pointing at the
  official record rather than presenting itself as the last word.

Content without a brief keeps rendering the markdown article, so this is
additive rather than a cutover.

## Scope

Bills only, for now. The schema is written around legislative mechanics —
before/after provisions, sponsor-vs-text framing, "would" vs "does" — and
executive actions and court cases each need their own design pass. The
`content_brief` table already carries a `contentType`, so adding one is a
generator and a schema, not a migration.

## Running it

```bash
# Backfill bills that have no brief, or whose brief is stale
pnpm --filter @acme/scraper run retroactive-briefs --limit 20
pnpm --filter @acme/scraper run retroactive-briefs --dry-run
```

New and changed bills get briefs automatically as part of the normal scrape
(`upsertBillBrief` in `utils/db/operations.ts`). `pnpm db:seed` writes two
example briefs so the UI is visible locally without an LLM key.
