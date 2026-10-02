# Election accountability prototype

This is proposed product work for [#429](https://github.com/billion-app/billion/issues/429), not a live results service. In a development Expo build, open `/accountability-preview`. Production renders an unavailable message even when opened directly; no tab or candidate page links to it. The route intentionally owns no shared ballot or office content files while those streams are in flight.

The historical example covers only the California statewide governor contest on November 8, 2022. The Secretary of State's [Governor totals](https://elections.cdn.sos.ca.gov/sov/2022-general/sov/19-governor.pdf) identify the two candidates and statewide outcome. The [December 16 certificate](https://elections.cdn.sos.ca.gov/sov/2022-general/sov/sov-certificate.pdf) establishes certification. A separate [January 6, 2023 inauguration record](https://www.gov.ca.gov/2023/01/06/governor-newsom-inaugurated-to-second-term-in-celebration-of-californias-values-diverse-communities/) documents Gavin Newsom taking office for the second term. These sources were inspected October 2, 2026. This static historical term example does not establish current incumbency. It intentionally has no campaign priorities or action records.

The scenario picker also exposes entirely fictional actions, preliminary counts, projections, disputed results and missing results. No synthetic claim links to a real official record. The fictional sponsorship illustrates why introducing a proposal does not establish passage or service delivery. Follow is a session-only demonstration; there is no persistence, notification registration or background fetching.

## Identity and evidence boundary

[model.ts](../apps/expo/src/components/accountability/model.ts) requires matching election, district, office, contest and candidate IDs, certification evidence, no unresolved dispute, and a separate taking-office record. Candidate names are display text. Missing candidates and counts cannot select a winner. Action records must match person, office, district and begin no earlier than the documented term entry. These local IDs have no provider mapping and must not be passed to a ballot provider.

Campaign statements remain attributed dated priorities. Actions have their own date, kind, source and context; displaying them together does not establish causality or a promise score. There is no generated explanation pipeline or database change.

## Publication gates and proposed operation

- **Results provider and correction operation:** #346 remains the national provider research owner. A bounded California adapter still needs verified retrieval, reuse terms, official contest identifiers and source version storage. Before publication, poll the official source on a documented schedule during counting, expose last successful retrieval separately from publication, and mark refresh failures as stale. No latency commitment is implemented here.
- **Identity mapping:** #418 owns ballot identity. Root coordination must approve a mapping table retaining upstream provider, election, district version, contest, office, candidate and person IDs. No name-only joins. Recounts, replacements and district changes need reviewed fixtures. #420 owns role powers and limits; this route does not duplicate that content.
- **Corrections:** replace source versions with a correction history, recompute term matches, and withhold the holder and actions when corrected or disputed records no longer match. Persist neither an inferred winner nor a silently changed identity. The static prototype cannot ingest corrections.
- **Action coverage:** #153 owns Congress.gov expansions and #324 House voting records. Neither is a California governor action source. California actions require a separately verified official adapter and term end boundaries. A recorded individual vote must retain the full body's outcome; sponsorship cannot be treated as passage. Missing actions must remain unknown. Establish action refresh cadence and correction provenance before implementing follows.
- **Editorial and reader validation:** verify dated campaign source attribution, action context and institutional limits, then test whether readers distinguish certification from taking office and sponsorship from passage. Automated Astra review does not replace these gates.
- **Runtime:** native and production-flow verification are required before public navigation is added. Development screenshots alone are prototype evidence.

This draft addresses the state/identity and reader experience design, with executable fixtures and tests. It does not close #429's live-data, sustained-following or production mobile acceptance criteria.
