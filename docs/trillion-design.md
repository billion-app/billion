# The Trillion: interaction design

Status: **in progress** for [vision issue #455](https://github.com/billion-app/billion/issues/455). Implemented: the graph schema and machine publication gate (`packages/validators`, `packages/api/src/lib/trillion.ts`), the read-only `civic.getTrillion` API, the seeding pipeline with curated historical precedent ([CLI guide](../apps/scraper/README.md#trillion-argument-graphs)), and a quote-verified Prop 40 pilot graph ([evidence](evidence/455/)). Not yet implemented: the Expo screens (the [phone mockup](../prototypes/trillion/mobile.html) shows the intended behavior), public contributions, accounts, and moderation. The [design prototype](../prototypes/trillion/index.html) is a static HTML fixture.

The Trillion (Tree of Arguments Within Billion) is how a reader works through the reasoning about a record. It replaces "summary cards plus a comment thread" with a graph of claims a reader can follow, question, and extend. Billion starts the reader's thinking; the graph never ends in a verdict or a voting recommendation.

This document records the decisions made in the October 2026 design review and the reasons for them. A section marked _Open_ is still undecided.

## Decisions at a glance

| Question                        | Decision                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Who writes the graph            | The pipeline seeds source-text claims and anticipated questions. The public adds arguments and questions from launch.                     |
| Primary surface                 | Phone (Expo). Desktop adds a canvas beside the same reading view.                                                                         |
| What a node is                  | A claim. Every edge is typed, carries an explanation, and can itself be challenged.                                                       |
| Graph scope                     | One graph per record. Records link to shared global claims, such as moral frameworks, through edges that must justify reuse.              |
| Root of a record's graph        | The reader's own decision question, worded by record type.                                                                                |
| Who / What + Why / When / How   | All are branches of the same graph for now. No tabs.                                                                                      |
| First thing a reader sees       | A small live map of the question and its four basics, above the focused claim page. Everything else is revealed on request.               |
| Ordering of children            | By debate structure, plus editorial picks on seeded records. Never by popularity or agreement.                                            |
| Duplicates and global promotion | Claims start local. Duplicates are merged into global claims through promotion, later assisted by votes and an AI curator.                |
| Seeded content                  | Labeled by provenance, open to challenge, and gated by existing editorial review.                                                         |
| Who sets an argument's lean     | Whoever adds the argument. The lean can be challenged like any link; votes may flag a lean for review but never decide it.                |
| Whole-debate overview           | A Kialo-style sunburst of the disputed questions, opened from the map into a drawer, so thin parts of the debate are visible at a glance. |
| Moderation (post-prototype)     | An automated structural check before publishing, then post-moderation. The check never judges truth or viewpoint.                         |
| Historical precedent            | A seeded "Has this been tried before?" question backed by curated, quote-verified past audits and analyses.                               |

## The model

### Claims are nodes; relationships are arguable

A **claim** is one statement that can be examined: a quoted provision, a factual assertion, a prediction, an interpretation, or a value judgment. Each claim records its kind, because the issue's central distinction is between what a record states and what people infer from it.

A **relationship** (edge) connects two claims and carries three things:

1. A type, written in plain language: _supports_, _challenges_, _qualifies_, _depends on_, _applies to_, _answers_, or _asks about_.
2. An explanation of why the link holds in this context.
3. Its own attribution.

Readers can open an edge the same way they open a claim and argue with it. This is what a comment thread cannot express: "I accept both premises, but the conclusion doesn't follow," or "Utilitarianism is fine, but it doesn't apply to this bill." Structurally, an objection to an edge is a claim about the link between two claims. Readers see it as a challenge to "the step," not as a new abstraction.

### One graph per record, linked to shared claims

Each bill, measure, or candidate has its own graph. A claim that recurs across records, such as "Taxing wealth rather than income is fair" or "High earners relocate in response to state taxes," lives as a **global claim**. A record reaches a global claim only through an _applies to_ edge, so reuse always prompts the question "why does it apply here?"

The view always stays anchored to a record. A global claim shows "Used in N other records" rather than expanding into every place it appears. A fully global canvas becomes a constellation nobody can read.

Claims start local. When the same idea appears across records, it is **promoted**: merged into a global claim, with each local wording kept as a contextual use. A small curated set of global claims seeds the system. Later, duplicate votes and an AI curator propose merges; the prototype shows only the "Possible duplicate of…" banner where that work will surface.

### The root is the reader's question

Every record's graph starts from the decision the reader actually faces, worded by record type:

| Record type    | Root wording                    | Where it leads                         |
| -------------- | ------------------------------- | -------------------------------------- |
| Ballot measure | "How should I vote on Prop 40?" | The reader's private ballot choice     |
| Candidate      | "Should I vote for [name]?"     | The reader's private ballot choice     |
| Bill           | "Should SB 123 become law?"     | Contacting the responsible legislators |

The root never shows a tally, a lean, or a verdict. A reader's choice stays in private preparation ([#445](https://github.com/billion-app/billion/issues/445), [#454](https://github.com/billion-app/billion/issues/454)) and never becomes a public contribution.

The root has four fixed **orientation branches** that every record shares, so readers learn one skeleton:

- **What does it actually do?** Quoted provisions, each a source-text claim. Interpretations hang off the provision they interpret.
- **Who's behind it?** Proponents, opponents, sponsors, and funding. Funding is evidence of a relationship, not proof of motive.
- **When?** Official dates, kept separate from retrieval and update timestamps.
- **How can I act?** Verified ways to participate. Missing channels stay missing rather than invented.

Beside those, the root branches into **the questions people actually disagree about**, such as "How much money would it actually raise?" or "Is it fair to tax wealth instead of income?" Arguments are grouped under these questions rather than sorted into a yes column and a no column, because most real arguments change the decision without being cleanly for or against. Each argument carries its lean toward the vote as a stance ("leans yes," "leans no," "cuts both ways"), shown as a color and a word on the card.

Each disputed question names the kind of disagreement, following the issue's call to distinguish facts, assumptions, and values: "Disputed facts," "Mostly values," "Disputed reading of the text," or "Depends on courts and other measures." Each also shows its state, such as "2 unanswered," "Contested," or "Few arguments yet." The state says where the debate stands, never who is winning. The pipeline seeds disputed questions with provenance labels like any other node, and readers can propose new ones.

### Who sets an argument's lean

A lean says which way an argument points, not whether it is right. "Billionaires will move away, so revenue will fall short" leans no whether or not it is true; its truth is argued in its own Responses. Because the lean is a reading of the argument rather than a judgment of it, it does not need a vote:

- **Seeded arguments:** the pipeline sets the lean when it builds the graph. Most come from the official ballot arguments, so a quote from the argument against leans no.
- **Reader contributions:** the contributor chooses the lean when linking an argument to a disputed question.
- **Disagreement:** the lean belongs to the link between the argument and the question, and every link can be challenged. "This actually cuts both ways," with a reason, appears as a response like any other.

A public vote on leans was rejected. It would turn into a vote on the argument, and the leans would add up to a disguised tally of support, which the main case must never show. _Proposed, with accounts:_ votes or karma may flag a contested lean for a closer look, the AI curator may flag a lean that contradicts the argument's text, and a person verifying the graph confirms leans when the "AI generated" notice is removed. None of these decides a lean on its own.

### One layered view, not a summary

There is no separate simplified mode. The first layer of the graph is the simple view: the question, its four basics, and the disputed questions. Each tap goes one layer deeper. Because the overview is the top of the graph rather than a separately written summary, every line in it leads somewhere further, and nothing in it can drift into a final answer.

Two cues keep the first layer from reading as the conclusion (the Bradbury principle):

1. Every disputed question shows its state, so "Unanswered" and "Contested" are visible before the reader goes deeper.
2. The main case ends in a door, not a takeaway: "The debate starts here, not ends," with links to the disputes and to everything still unanswered.

Who, When, and How are graph branches rather than tabs, to keep the model consistent while it is unproven. Their facts can also serve as evidence inside the debate, for example when a funding record is attached to a claim about a sponsor's incentives. _Open:_ common lookups such as deadlines may later earn a fixed tab or a reader-customizable shortcut.

## The reading experience on a phone

**Keep text short.** Early reviewers found the first version too wordy. The screen explains the measure, not the app: the main case shows only its question, the AI notice is one line ("AI-written · Check the sources") with details on tap, tab names are one word where possible, and list rows show the relationship, source, and statement without the link's explanation, which lives on the link's own page. Every line that explains how the Trillion works has to earn its place against one more line about the measure. Statements are set in regular weight with one or two key phrases in bold, the same rule as Billion's bill briefs: the generator wraps the phrase a skimmer most needs in `**`, and the schema rejects a bolded whole statement, more than two bold phrases, or any emphasis inside a label or verbatim quote. Questions stay bold headings. Summaries (map cards, a preview's list of what is inside) use each card's short label.

### Focused claim page

One claim fills the screen:

1. **Breadcrumb.** The path the reader took from the root. It records their route, not a hierarchy.
2. **What this rests on.** Incoming premises and the edge that connects each one.
3. **The claim.** Its kind ("From the measure text §50310", "Ballot argument against", "Reader contribution"), its full text, attribution, and source locator.
4. **What responds to it.** Challenges, qualifications, answers, and downstream uses, ordered as described below. Each row names its edge type in words.
5. **Add.** Add a reason, challenge a specific point, add a condition, attach evidence, or ask a question.

Tapping a row moves focus to that claim. Tapping an edge label opens the edge's own page. Back returns along the breadcrumb.

Empty sections describe coverage, not consensus: "No one has challenged this yet." Counts describe connections, never agreement or credibility.

### Show less at first

A first-time reader should not face every argument at once. The graph reveals itself as the reader asks for more:

- Connections are split into **category tabs**, and the map and the list both show only the selected tab. The main case has Basics, Disputes, and Unanswered. A disputed question has Arguments and Questions about this. Other claims have Responses, Rests on, and Used in (branches show Inside). An earlier Case for yes / Case for no split was rejected because it made picking a side the reader's first move.
- The main case opens on Basics, so a new reader sees the question and four cards.
- The map shows only the main case, the current claim, the previous step, and the selected tab's cards. Everything else is hidden rather than grayed out; a full gray constellation was prototyped and rejected as too busy. Lists show four rows, then "Show N more."
- The main case is always on the map, drawn bold with a gold border, and never dims. "Go back to main case" appears on the map and in the reading column whenever the reader is elsewhere, and the first breadcrumb is always "Main case."
- The previous claim stays on the map, dimmed, so the step back is visible.

### Map

The map is rendered with Cytoscape. On a phone, a small live map sits at the top of the page and expands to full screen. On desktop, it fills the canvas beside the reading column.

- Cards float in a force simulation, similar to Obsidian's graph view. Cytoscape draws the cards, and d3-force moves them. Links pull connected cards together, cards repel each other, and each one drifts slowly once the map settles.
- Dragging a card pulls its neighbors along. Releasing it lets the map settle again. The focused claim stays pinned.
- On navigation, cards that leave fade out and shrink, and new cards grow out of the card the reader tapped. The camera glides toward the visible cards frame by frame. Any manual pan or zoom stops the glide. With reduced motion turned on, the map is laid out once and changes without animation.
- Readers can pinch, scroll, or use the zoom buttons. Default framing stays at reading size even when only a few cards are shown.
- Global claims have a dashed border; other records have a blue double border.
- **The whole debate** is a small sunburst, borrowed from Kialo, behind a "Whole debate" button on the map. It opens in a drawer so it never competes with the map for space. The center is the main case. The inner ring holds the disputed questions, the next ring the arguments under them in their lean colors, and the outer ring the responses. A slice's width is the amount of debate beneath it, so a thin question is visible without listing every card. A dashed slot marks a question with almost nothing under it, and a "Least explored" link names the thinnest question. Tapping a slice previews it (see below), with a way back to the ring. On desktop, hovering a slice names it in place. The basics are left out, because they are orientation rather than debate and would crowd out the disputes.
- **Tapping previews; it never moves the reader.** Tapping a card or link on the map, or a slice of the sunburst, opens a drawer with the full statement, a clamped quote with its locator, how the card relates to where the reader is, and what sits beneath it ("Responses 2 · Rests on 1"). A separate "Go to this" button moves there. Readers can be curious about a card without losing their place, and an accidental tap on a dense map costs nothing.
- Map cards carry the same detail as list rows: how the card relates to the focus in its color ("Leans yes"), a short label written for the map ("Who signed for", not the full list of signers; the full statement is one tap away in the preview), and where it comes from ("Ballot argument for", or a disputed question's state). Link lines carry color and direction only, because the card already says the relationship. The cards are HTML laid over the Cytoscape canvas, so they use the app's type styles.
- The map reads top to bottom: the main case and the previous step above, the focus, then the open tab's cards below, in one or two columns. The camera never zooms out past reading size. When the cards don't fit, it keeps the focus near the top and lets the rest run off the bottom edge for the reader to pan to.
- The preview drawer gives the full statement, and the quote shortened to a few lines with its locator. The complete verbatim quote is on the card's own page, one tap further. A link's preview shows both cards it connects and why it holds; structural links such as "Part of" say in plain words what they mean.

The map supports orientation. Every core task can still be completed from the list, without pinching or dragging.

### Relationship colors

Relationships are color-coded with Billion's existing nonpartisan outcome hues: teal for supports and leans yes, coral for challenges and leans no, violet for qualifies, cuts both ways, and conflicts, and amber for questions and answers. The same color appears on the map edge, the row's stripe, and the relation chip. A written label always accompanies the color, and the palette avoids party-coded red and blue.

### Ordering children

A popular objection is not necessarily a strong one, so children are ordered by the state of the debate:

1. Unanswered challenges.
2. Challenges with evidence attached.
3. Challenges whose own premises have been challenged.
4. Everything else.

On seeded records, editors may pin a few items as featured. Quality ratings were rejected because in practice they become agreement votes.

### Desktop

Desktop shows the canvas and the focused claim page side by side. Selecting a node on either updates both. The canvas is never the only way to reach anything.

## Provenance

Every claim shows where it came from:

| Provenance          | Label                               | Rule                                                                         |
| ------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| Source text         | "From the measure text §50310"      | Verbatim quote with a locator to the official record                         |
| Official analysis   | "Legislative Analyst"               | Quoted, attributed, and kept separate from Billion's explanation             |
| Published argument  | "Ballot argument against · signers" | Attributed to its signers exactly as published                               |
| Billion-generated   | "Generated by Billion · cites X"    | AI disclosure, citations required, editorial review before public visibility |
| Reader contribution | Contributor's handle                | Public, attributed, and reportable                                           |

Generated claims and anticipated questions pass the same publication gates as existing generated content. This design relaxes none of them.

## Contributing

Every contribution needs a **target**: a claim, a specific edge, or a quoted passage. The composer keeps the target visible throughout. It asks for the edge type and an explanation of why the link holds, and it searches existing claims so the writer can reuse one instead of restating it. Reuse keeps the original attribution and requires the writer to explain applicability in the new context. A question remains open until someone answers it.

### Moderation (after the prototype)

An automated check runs before publishing, followed by post-moderation and reports. The check is limited to **structure and safety**: there is a target, the contribution is one claim, the link is explained, and it contains no abuse or personal information. It does not judge whether a claim is true or which side it favors, and its prompt and decisions are auditable. Failures return to the writer with suggested fixes.

Identity, sign-in providers, rate limits, appeals, and revision handling are out of scope for the prototype. Before public contribution launches, those need decisions.

## Historical precedent

The guide alone cannot answer one of the first questions a voter asks: has this been tried before, and did it work? So each measure can carry curated precedent, held to the same rules as the rest of the seed.

- **Sources are archived official PDFs, chosen by a person.** A precedent source comes from the State Auditor, the Legislative Analyst, or a past voter guide, and must be a PDF so freshness can compare document bytes. The pipeline finds the current guide on its own, but nothing yet tells it which earlier measures are comparable, so a curated list per measure names them ([`trillion-precedents.ts`](../apps/scraper/src/scrapers/trillion-precedents.ts)). An entry can limit capture to a page range, so a long audit contributes only its findings to the prompt. A search step that proposes candidates for review is future work.
- **Quotes stay separated.** Precedent claims are their own node kind, quote only precedent sources, and only they may quote precedent sources. A past audit can never read as this measure's text, and the measure's text can never pass as history. Every precedent quote is verified verbatim, so the reader sees the auditor's own sentence rather than a summary of it.
- **It lives in the graph.** Precedent seeds one disputed question, "Has this been tried before, and did it work?", typed as _Disputed facts_. Each precedent card weighs on it with a lean, and may support, challenge, or qualify a specific argument. That link's explanation must say how the earlier measure is similar and how it differs, and readers can challenge the comparison like any other link.

The Prop 40 pilot cites two documents. The [State Auditor's 2018 report](https://information.auditor.ca.gov/pdfs/reports/2017-117.pdf) on Proposition 63 (2004), a 1 percent tax on incomes over $1 million set aside for mental health, found that local agencies had let a large amount of that money go unspent. It supports the argument that nothing stops Prop 40's money from being misdirected, and weighs on "Where would the money go?". The [Legislative Analyst's Prop 55 analysis](https://www.lao.ca.gov/ballot/2016/Prop55-110816.pdf) shows a tax on high earners sold as temporary being extended, which supports the "one-time money" argument. It also shows that revenue from the richest taxpayers swings with markets, which qualifies the revenue estimate.

## Prior art: Kialo

[Kialo](https://www.kialo.com) is the closest existing product: one thesis at the top and a tree of pro and con claims beneath it. The comparison shaped several decisions.

| Kialo                                                 | The Trillion                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every claim is a pro or a con of its parent.          | Arguments group under disputed questions and carry a lean, because most real arguments are not cleanly for or against. See [the root](#the-root-is-the-readers-question).                                      |
| Sunburst overview of the whole discussion.            | Adopted for Map view, limited to the disputed questions. See [Map](#map).                                                                                                                                      |
| Impact voting ranks claims.                           | _Proposed, with accounts._ Ratings may help merge duplicates and flag weak or mislabeled claims, but never order a list or decide a lean, so they cannot become a verdict. See [ordering](#ordering-children). |
| One claim can be linked into several places.          | The same idea as global claims reached through _applies to_ edges, which must explain why the claim applies.                                                                                                   |
| Suggested claims wait for moderator approval.         | An automated structural and safety check, then post-moderation, because Billion has no moderator team to approve every contribution. See [moderation](#moderation-after-the-prototype).                        |
| Claims are contributors' own words; sources optional. | Every seeded claim is tied to a verified verbatim quote from the official record. This is the main thing Kialo cannot offer: it cannot show what the measure actually says.                                    |

## Prototype: Proposition 40 (November 2026)

The prototype uses a real record because fictional content hides the real problems. Proposition 40, the 2026 Billionaire Tax Act, was chosen because it looks simple and is not:

- The ballot label says "one-time tax," but the text includes a five-year installment option with a 7.5% annual charge, and deferral accounts that bind a taxpayer's estate until settled (§50301(c), §50304).
- The ballot arguments disagree on checkable questions: whether retirement accounts are taxed (§50303(c)(7) exempts qualified pensions and IRAs but not Roth balances over $10 million), and whether the Legislature can expand the tax (§50310 allows two-thirds amendments "consistent with and furthers the purposes" of the act).
- Liability depends on residency on January 1, 2026, ten months before the vote (§50308(n)). Proposition 42 §2(a)(2) targets that pattern directly.
- Propositions 41 and 42 each declare Prop 40 in conflict. Whichever conflicting measure receives more yes votes prevails. A reader cannot answer the Prop 40 question without the other two records, which exercises the cross-record links.

The fixture quotes only official sources: the measure text and the Legislative Analyst's analysis from the [Official Voter Information Guide](https://vig.cdn.sos.ca.gov/2026/general/pdf/complete-vig.pdf), and the [ballot arguments and rebuttals](https://voterguide.sos.ca.gov/propositions/40/arguments-rebuttals.htm) attributed to their signers. Reader contributions in the fixture use fictional handles such as `example-reader-1`, and each is labeled as a prototype example. The fixture lives in `prototypes/trillion/` and never enters a database. Seed data previously reached production attributed to real sources, so this separation is a requirement.

### What the prototype covers

- The focused claim page, breadcrumb, and back navigation
- The progressive Cytoscape map with "+N more" nodes, zoom, and animated expansion
- Color-coded relationship rows and edges
- Edge pages, including a reader challenge to an inference step
- Global claims reached through _applies to_ edges
- Cross-record stubs for Propositions 41 and 42
- A "Possible duplicate of…" banner
- Source inspection
- A simulated composer that stops at a preview
- The desktop side-by-side layout

Out of scope: sign-in, persistence, voting or karma, and moderation UI.

### Evaluating it

Ask readers to:

1. Identify what Prop 40 actually taxes.
2. Find where the ballot arguments disagree with the text.
3. Explain why a Prop 40 yes vote might not take effect.
4. Locate a disagreement about values rather than facts.
5. Add a challenge to a specific step.

Watch for wrong-target contributions, lost navigation, and readers who treat the graph as complete or as Billion's verdict. Any of those is a design failure, even if every control works.

## Integration with existing work

Measure context ([#444](https://github.com/billion-app/billion/issues/444)), measure relationships ([#447](https://github.com/billion-app/billion/issues/447)), and candidate research ([#443](https://github.com/billion-app/billion/issues/443)) are interim entry points. Their outputs become seeded claims and relationships in the graph. Person profiles ([#452](https://github.com/billion-app/billion/issues/452)) feed the Who branch. Mobile data access continues through tRPC, as described in [architecture](architecture.md). The visual language follows [content-detail design](content-detail-design.md) and [Expo styling](expo-styling.md).

_Open:_ the persistence schema, the generation pipeline for seeded claims, and the ranking implementation. These wait until the interaction model holds up with readers.
