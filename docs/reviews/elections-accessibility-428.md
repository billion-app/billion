# Elections accessibility audit — issue #428

This is an implementation audit and verification checklist, not completed reader
or assistive-technology testing. The production entry is the California statewide
preview. Address lookup scenarios are development fixtures; they cannot establish
production ballot coverage. Source collection belongs to #298.

## Changes in this PR

The California guide links to `election-access` before its network-dependent
content, so official help remains discoverable when the guide fails or is empty.
The screen separates statewide hotline support from local ballot languages and
location access. Official pages were checked on October 2, 2026: the hotline page
lists ten languages and relay support; the November guide page announces
translated PDFs for October without providing download links at that check.
The screen links to current official pages rather than fabricating translated
PDF URLs. These checks are automated source inspection, not editorial approval.

The preview now exposes its headline as a heading and retry as a button with a
48-point minimum height. Proposition titles wrap instead of being truncated;
proposition number tiles can grow with text. Resource labels wrap alongside
icons. Existing shared SourceLink handles failed external opens and provides
44-point minimum targets; no new animation was introduced.

## Journey audit and remaining checks

| Stage                 | Static findings                                                                                                                              | Required running verification                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Elections preview     | Candidate buttons identify person and office; proposition disclosures expose expanded state; resource action precedes loading/error content. | VoiceOver reads party and navigates all visible actions; error/empty recovery and new resource action remain reachable.                     |
| Race                  | Search has a label, party filters use checkbox state, cards identify candidates and disclosures; content is supplied by tRPC.                | Filter focus order, results-change announcements, long office and candidate names at accessibility text sizes.                              |
| Candidate             | Heading, expandable statement, source and language disclosures exist; generated explanation is separate from source.                         | Full statement reachable without truncation; focus after expansion; portrait does not duplicate card identity.                              |
| Measure / proposition | Yes and No outcomes have text; original text and source links remain available.                                                              | Long titles, outcome reading order, source disclosure, argument expansion at maximum Dynamic Type.                                          |
| How to vote           | Date rows announce dates and expanded state; postmark requirement is text; location categories and missing details are explicit.             | Back restores context; disclosure focus; long addresses/hours; failed link recovery; no stale election response.                            |
| Language resources    | Statewide official help is separate from unverified local availability.                                                                      | Open hotline page, choose an advertised language, confirm resource works; translated November PDFs must be checked again after publication. |

No native production VoiceOver or enlarged-text task, non-English-reader
comprehension, or unfamiliar-reader usability pass is claimed by this audit. Keep the PR
in draft until the required production mobile checks and editorial source review
have been recorded. Web screenshots and browser enlargement are supplemental.

## Requirements for the parallel education streams

For #419/#420/#423/#426 and governance prototype #403, place the complete meaning
in readable text beside any timeline, comparison or diagram: office, actor,
sequence, consequences, uncertainty and citations. Hide decorative geometry from
screen readers; never hide the only explanation in a graphic, color or motion.
Reduced motion must preserve meaning. Use contextual definitions such as
“proposition — a proposal voters approve or reject” at the point of use.

Controls need a role, descriptive label, selected/expanded state where applicable,
a 44-point target and wrapping labels. Content must reflow at accessibility text
sizes without horizontal scrolling or line limits that conceal the task. Check
text contrast on the actual surface, including muted source metadata. Preserve
source text versus generated explanation and unknown versus unavailable services.

Root coordination should inspect the other streams' actual screenshots and
diffs using this checklist after publication; this PR does not certify future UI.
Do not reuse #298's absent fields as negative accessibility claims. The current
How to Vote work in PR #414 is a separate dependency to verify when integrated.

## Running evidence

Captured from this branch's Expo web development server at 390 × 844 with a
completed-onboarding browser profile. No ballot fixtures were used on the new
resource page; the guide error was deliberately created by aborting tRPC requests.
The profile avoids an existing first-run onboarding SVG error on web. No claim
about the first-run journey is made.

- [Resource screen](assets/428/resources.png)
- [Supporting resource details](assets/428/resources-bottom.png)
- [County checklist expanded](assets/428/resources-expanded.png)
- [200% browser text](assets/428/resources-large.png): no horizontal page overflow;
  CSS font/line-height enlargement is **not** native Dynamic Type verification.
- [Forced guide error](assets/428/guide-error.png): resource button still opens.
- [Spanish destination](assets/428/spanish-resource.png): pressing the app's
  bilingual link opened the official page headed “Declaración de Derechos del
  Votante”. This confirms navigation and translated content, not comprehension
  or translation quality. Other translated flows remain untested.

Checks: Expo typecheck passed; Expo tests passed (184 pass, 1 skip, 0 failures);
production iOS bundle export passed. Full-screen native VoiceOver/enlarged-text
verification and unfamiliar-reader testing remain required before completion of
#428. This PR implements focused improvements and records the remaining audit.

## Concrete audit follow-ups

The legacy address lookup in `(tabs)/elections.tsx` calls
`LayoutAnimation.configureNext` during disclosure changes without a reduced-motion
guard, and its older measure toggle lacks a button role/expanded state. #418 should
resolve these when replacing/integrating that path; the statewide preview changed
here introduces no layout animation. Do not treat the static audit as a pass.

Computed token contrast for quiet text (`#8A8FA0`) on slate (`#272D3C`) is
4.27:1, below the 4.5:1 normal-text threshold. This PR uses `inkOnNight` for
preview card metadata, supporting labels, and recovery copy (12.53:1 on slate).
SourceLink blue on its navy button surface is 4.81:1. Other streams should inspect
muted card text using the actual composited surface. Candidate card accessibility
labels now include the supplied party instead of dropping visible information.

## Rigorous design follow-up

A fresh independent Astra reviewer inspected the running screenshots before
implementation rationale. Its first critique found that the multilingual hotline
was buried beneath county caveats, the large-text preamble delayed every action,
and the guide status required reading a publication narrative. The independent
four-PR audit's #438 findings agreed: organize around help tasks, shorten local
guidance, disclose the checklist, and put dated availability before metadata.

The revised screen leads with the hotline, accessible-voting destination and
county discovery. The short editorial title leaves the first hotline action
visible at 200% browser text. Languages, the county checklist and source details
expand on demand, while local availability remains visibly unverified. The
translated guide shows its dated status and statewide scope before any expanded
background explanation. Retry is now a bounded action. Development scenario
controls remain excluded from production by the existing `__DEV__` gate.

The same reviewer found the first revision serviceable but wanted visible native
language cues and practical county guidance. Those became a compact multilingual
preview, an explicit “All 10 hotline languages” disclosure, an action-led county
summary and a clearly named elections-office link. Its final screenshot review
described the screen as polished and compelling through clear routes and trust,
with no further visual redesign required for this scope. The subsequent diff
review approved the disclosure behavior and preservation of material limitations.
The optional wording precision “voting at home” was also applied.

Runtime verification exercised both disclosure states, confirmed content and
expanded semantics, followed the Spanish link to the real official page, and
navigated from the forced guide-error state to Voting help. These results are
browser evidence. A compelling Astra design review does not replace the native,
editorial, other-stream integration or real-reader gates above.
