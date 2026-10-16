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
icons. The ballot-specific OfficialResourceLink preserves failed external opens and
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

## Visual recognition follow-up

The four resource categories now pair their heading with a globe, accessibility
symbol, location pin or book. These use the existing primary-blue accent on navy
and the shared Icon primitive; the only shared addition is the verified local
Ionicons `accessibility-outline` mapping. The symbols help readers recognize a
route without adding another paragraph. They repeat the text meaning, carry no
service-availability claim, and are hidden from web/iOS/Android accessibility
APIs. Headings remain the complete screen-reader equivalent.

The same independent Astra reviewer inspected the running captures before the
iconography diff. It found the recognition improvement modest but meaningful,
and said the prior polished and compelling assessment still holds. No new source,
clarity or code/accessibility blockers were found. At 200% browser reading text,
the first hotline remains visible; the capture keeps decorative vector glyphs at
their fixed size, matching the library's `allowFontScaling: false` default. This
refines the synthetic browser check, not native Dynamic Type evidence. All native,
reader, editorial and integrated-journey gates remain outstanding.

## Bills design alignment

The live Bills reference was captured in the same Expo web app, dark theme and
390×844 viewport using CA SB 492 (`fa107d14-8165-482c-acc4-d1938af4c215`), with
server-provided data rather than a fixture. This is visual comparison evidence,
not verification of that bill's generated explanation. The Bills captures include
an existing development warning overlay; it was not treated as design guidance.

Voting help now follows BillBrief's 17-point editorial card headings, 15/23 body
text, 14-point card corners, subtle `hair[1]` borders, slate/surface planes and
small source/disclosure controls. Its category icons retain the task meaning and
use the Bills blue icon treatment. The guide has a compact jurisdiction header,
26-point editorial title, restrained proposition-number tiles and matching card
borders. All tokens come from `~/styles`. No parallel palette, legislative
progress metaphor or party/outcome judgment was introduced.

A fresh independent Astra reviewer first compared the actual Bills and Elections
captures. It found the initial cream actions and gray icon tiles inconsistent
with Bills. Compact blue-tinted controls and Bills-style icon tiles resolved both
findings; the reviewer then found no further actionable screenshot-only design
findings. Its independent code review caught an unused import, which was removed,
and found no substantive correctness or regression issue. The smaller resource
captions use 72% white: 7.90:1 contrast on slate, 9.63:1 on navy and 6.94:1 on
surface. Essential local-availability limits remain visible.

The ballot-specific OfficialResourceLink is reused by this route and its statewide
guide entry, avoiding changes to the generic shared evidence component. Root
integration must reconcile CaliforniaGuidePreview with other Elections streams;
the prior additive Icon mapping remains the only generic UI change in the PR.
The reviewer also checked the live candidate and proposition cards and final
guide-error capture; no actionable design or code findings remained. Unique
Metro port 8428 was verified with its process cwd pointing at this worktree.
Native VoiceOver/Dynamic Type, real-reader comprehension, editorial review and
integrated-journey gates remain outstanding. No merge or release is authorized
by this evidence.
