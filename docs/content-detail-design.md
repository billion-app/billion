# Content-detail design language

Every new Billion content type must follow this design language and the workflow below. The goal is a brief a reader can scan, explore, and verify: each stopping point should teach something true without requiring the whole article. Adapt the information architecture and interactions to the content type while sharing the app's typography, cards, and source-disclosure conventions.

This is a product and implementation requirement. A new type is not complete when its source text has merely been wrapped in the bill layout or converted into a long Markdown explanation.

## Shared language, specific structure

Use the editorial headings, readable body text, surface colors, card borders, spacing, and emphasis conventions exposed through [Expo styles](../apps/expo/src/styles.ts). Follow the [styling guide](expo-styling.md) rather than creating a separate palette. Color can help distinguish categories, but written labels and icons must carry their meaning; color must not imply that an outcome is good or bad.

Lead with a short, standalone takeaway, then offer useful depth through focused cards, reading modes, and disclosures. Choose those elements around the reader's questions and the source's actual structure. A legislative progress path makes sense for bills; it does not describe what a court has decided. Sharing the visual language does not require identical fields, section names, tabs, or interactions.

Prefer everyday words. When a legal or procedural term is necessary, define it inline where the reader encounters it, either in the sentence or through an accessible tap-to-define interaction. A glossary can supplement this but should not require a reader to leave the passage to understand it. Keep essential limits and unknowns visible alongside the explanation, rather than hiding qualifications behind optional detail.

## Explanation and evidence

Generated explanation, quoted source text, and outside commentary have different authority. Keep them visibly distinct:

- Identify Billion's AI explanation and make its provenance details available. A verified quote means the passage matched the source; it does not certify the surrounding analysis.
- Give claims a path to their supporting record. Use source disclosures for verified quotations, with a locator when available, and links to official documents. Do not fabricate a quote to fill a card.
- Preserve a separate original-text or record reading mode. The reader must be able to inspect the underlying text and open the official source independently of whether a brief exists.
- Attribute arguments and opinions to their speakers. Keep researched perspectives in the cited lens rather than presenting them as the official record. Omit unsupported detail and say what the record does not establish.

The [article-detail route](../apps/expo/src/app/article-detail.tsx) owns the shared reading modes, AI disclosure, and source-passage navigation. [Article generation](article-generation.md) explains grounding, quote checks, and the distinction between briefs and lenses.

## Current examples

Bills use the [bill schema](../packages/validators/src/bill-brief.ts) and [BillBrief](../apps/expo/src/components/ui/BillBrief.tsx) to explain a proposed or enacted change. The short summary expands into a fuller explanation; before/after cards separate current law from the change, affected-group cards explain concrete consequences, and unknowns preserve uncertainty. Key terms, cited history, and optional deeper reading support further exploration. Legal status comes from the source lifecycle, and the surrounding detail screen shows legislative progress only for bills.

Court cases use a separate [court schema](../packages/validators/src/court-brief.ts) and [CourtBrief](../apps/expo/src/components/ui/CourtBrief.tsx). The reading starts with what the court did and what request it was deciding. Reasoning, separate opinions, ordered versus possible effects, and unresolved questions each retain their own meaning. Emergency relief is not a final decision on every underlying legal question. The UI offers inline legal-term definitions, an Opinions mode when opinions are available, and a Court record mode. Individual points link to official documents, and source disclosures lead into the original text. Court, docket, date, and proceeding identify the record without inventing a legislative timeline.

These are examples of adapting the same language, not templates whose fields must be copied into the next type.

## Required workflow for a new content type

1. Read representative official records, including sparse and ambiguous examples. Identify the reader's questions, the type's legal or procedural states, and the distinctions that a summary must preserve.
2. Design the reading structure and interactions around those questions. Decide what belongs in the short takeaway, what needs its own card or mode, where terms need definitions, and how a reader reaches evidence from each section.
3. Define a versioned structured-output schema in `@acme/validators` for those concepts. Separate generated fields from source-derived metadata; represent attribution, uncertainty, and source references explicitly. Reuse shared primitives where they fit without forcing the type into bill or court semantics.
4. Connect generation, deterministic verification, persistence, and the API to that schema. Keep original records independent and preserve a usable fallback for missing, invalid, or stale briefs. Follow the [architecture](architecture.md) and [generation guide](article-generation.md) for package boundaries and provenance.
5. Build the renderer using the shared visual language, then verify the actual detail screen with representative records. Check scanning, long text, missing sections, definitions, reading-mode transitions, quote disclosures, passage navigation, and official links. Confirm that the UI preserves legal status and attribution and never presents generated prose as source text. Use the applicable checks in [Contributing](../CONTRIBUTING.md#check-your-change).

## Next adaptation: executive orders

Executive orders are the next content type that still needs to be adapted to structured output. They currently use Markdown explainers; a dedicated structured executive-order brief and its content-specific detail experience are not implemented. Apply the workflow above to their directives, authority, affected agencies or people, timing, and limits, grounded in representative records. Treat that as upcoming design work, not as an existing schema or screen contract.
