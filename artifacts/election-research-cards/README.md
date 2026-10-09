# Candidate research cards — October 5

The user’s reference refines the election interior into research starting points, matching the existing How to Vote design language. Each question has a compact disclosure card with an icon tile, availability label, chevron, and prominent source action. Multiple cards can be open together. No rating, donor finding, or inference about future votes is added.

Actual iPhone 17 Pro simulator captures use Morgan Lee, a clearly fictional candidate:

- [Overview](overview.png): compact research cards, source availability, and the scope of the page.
- [Funding](funding.png): official filing resource, questions about contributors and reporting periods, and separate outside spending.
- [Statement](statement.png): candidate-authored source text and further research prompts.

Native review covers card expansion and collapse, funding details, background text, statement expansion, and the missing office guide. The original reviewed brief remains a development-only fixture; its evidence and publication gates remain intact.

Verification: workspace lint, typecheck, tests, formatting, and production iOS export. Expo has 234 passing tests and one skipped test. The workspace retains its existing Next.js image lint warning. This change was not deployed. No campaign finance ingestion or full live-ballot review was performed.
