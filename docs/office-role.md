# Office powers and everyday impact

The race and candidate screens share `OfficeRole`, a text-first explanation placed before candidate statements. The same jurisdiction and office context resolves to the same content: candidate identity never changes the office's authority. Existing official duty text remains separate. This adds to, rather than replaces, the governance-map prototype in PR #405.

The manually authored catalog in [office-role.ts](../apps/expo/src/utils/office-role.ts) currently covers the U.S. House, California Governor and Boston Council. Each entry pairs a power with a visible institutional limit, the people served, term and an illustrative consequence. Section-level official links support the claims. These are Billion paraphrases, not quotations, generated candidate analysis or predictions.

Matching requires explicit jurisdiction metadata. Unknown titles, missing districts and other jurisdictions show a coverage gap. Add aliases only after examining provider metadata; never infer a state's powers from a generic title. Local entries must not match a different city's charter. District council variants require separate verified matching before enablement.

## Publication gates for issue #420

This PR is an initial implementation, not complete nationwide coverage. Before publication, an editor must verify every material claim against its linked record, including the Boston enactment page (automated text extraction was unavailable). Research the remaining California offices and relevant state/local jurisdictions. No editorial approval is implied by checked-in content.

Run reader sessions on race and candidate pages: ask each reader to name one power, one limit and one practical consequence, without prompting. Record misconceptions and iterate. Verify the actual production iOS flow, Dynamic Type and VoiceOver traversal. Automated or model comprehension review cannot replace these gates.
