# Independent live release verification

PASS+NOTES. Verified on October 30, 2026 by a separate agent that made no implementation changes.

The Prove It Works principle changed this check into a fresh browser run and direct public API reads. The control-ui skill supplied the browser interaction and screenshot workflow. The poteto-mode Shipping playbook authorizes the independent PR verdict comment. Origin was unavailable, so this verification used gh.

The browser ran the existing Expo web server at http://127.0.0.1:8155 with a 393 by 852 viewport. Its workspace HEAD was 294ba88470b14157d03610e39536d7830b81d9dc. All candidate responses came from https://www.billion-news.app. There were no fixtures, response overrides, or request interception. The only seeded state completed local onboarding.

Observed behavior passed.

- Elections opens Explore the guide. Fiona Ma opens a rich brief with her actual name, promise, documented record, and reviewed date.
- Money explains that California totals, contributors, refunds, and independent spending are unavailable. It says unknown does not mean $0 and links to California campaign filings. The public API has finance null and an explicit financeGap for both Fiona Ma and Gloria Romero.
- Sources expose named publishers and source passages. A settled modal shows the certified Secretary of State roster, the two names, the quoted passage, the source URL, and the reviewed date.
- Fiona's promise opens In depth with its canonical release ID preserved. The page labels interpretation as AI-assisted, explains shared office authority, and identifies missing budget, timing, and outcome evidence.
- Compare the whole race includes Fiona Ma and Gloria Romero. Explore Gloria Romero opens her rich brief under the same canonical release.
- CA-17 shows Ro Khanna's named contributions and the 2025-01-01 through 2026-10-14 reporting period. Campaign receipts are $15,320,812.81. Refunds are $345,984.76 and are expressly outflows. Outside spending is shown separately from campaign receipts.
- BANERJEE, SUJIT opens a $14,000 contribution detail, then its FEC Processed Schedule A passage. The source identifies file 1978561, transaction 14378891, and sub-ID 4060820261520439708. The page says an interest area and influence are not established. The original filing link is available.

Direct public API checks confirmed the following releases and complete member-to-brief coverage. Claim evidence references and donor evidence references resolve within their briefs.

| Release | Members | Revisions |
| --- | --- | --- |
| dcaeb849-d023-4912-a20f-f9fc822af176 | Fiona Ma and Gloria Romero, 2 of 2 | 7a0ed9c6-a5a9-4c9c-aa33-4d46a2303928 and 88dd933c-825f-4358-9530-f1d99263e1e7 |
| d2d2b511-06b0-45bb-b24d-f269af2ea73a | Ro Khanna and Ritesh Tandon, 2 of 2 | 991b847b-7e2e-4ecd-8192-ea6cc692b6da and e15d4de0-06c6-4f97-8ae2-59b5589841a7 |

Direct forGuideCandidate calls separately returned published for Fiona and Gloria. CA-17 has 20 selected donor rows per candidate, with coverage limitations in the API. This verifies publication, attribution, navigation, and displayed coverage. It does not replace independent editorial review or re-audit all original source claims.

PR533 reads MERGED at 494b1a886a5917017b55fe83d9fa33934cee455e. GitHub Actions run 41107631576 reads completed and success at that merge SHA. A fresh request to the production Expo update endpoint returned update 01a18e1b-3948-714b-b7cf-3986a6400e35, runtime c843ba5dfbb07f7d24ce6fcec6b29252d0e50acf, production branch, and app version 0.9.1.

The browser workspace and merge SHA differ outside the checked candidate paths, including AddressForm, AddressAutocomplete, eas.json, app-store update code, and content-source-date. The candidate-research components, candidate-detail route, candidate-briefs router, and guide-candidate-research code have no diff between those SHAs. This is browser verification of that candidate code against the published API, plus independent OTA publication verification. It is not execution of the shipped native binary. No physical installation, native runtime, or human editorial review is claimed.

The earlier /tmp/pr531-real-candidate-ui/fiona-unpublished.png was visually inspected. It shows the generic research fallback and says reviewed research is unavailable. It is baseline behavior evidence only. The old binary was not run in this verification. The requested /tmp/pr531-runtime/detail-expanded.png did not exist.

Notes remain.

- The local browser logged CORS failures for the guest auth session endpoint. The main candidate workflow had zero page exceptions and production tRPC returned HTTP 200. A pending race request aborted during navigation. These observations do not establish a native failure.
- Published research is time bounded. CA-17 expires at 2026-10-31T07:09:48.086Z. Lieutenant Governor expires at 2026-10-31T18:38:02.485Z. Future availability depends on refresh and review policy.
- Initial probe assertions were corrected to permit the explicit unknown-not-$0 disclaimer and to follow the actual donor route and accessible source-button name. Those were harness mistakes, not product failures. The corrected checks passed.
- Source sheets animate. The first Fiona and CA-17 sheet screenshots were captured before the slide finished. The settled Gloria source and donor source screenshots provide the readable passage evidence.

Evidence lives in this directory. check.mjs is the main rerunnable browser check. detail-check.mjs covers Gloria and the donor drill-in. browser-evidence.json records URLs, response statuses, browser exceptions, console errors, and snapshots. api-checks.json summarizes the independently fetched API bodies. ota-response.txt is the fresh production update response. Screenshots 03, 04, 10, 12, 14, 18, 20, 22, and 23 are the principal visual evidence. No repository file was edited by this verifier.
