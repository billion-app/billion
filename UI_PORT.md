# UI_PORT — Digest hardcoded UI → real tRPC

**Purpose:** Map billion-digest hardcoded / mock UI fields to real backend procedures in billion `packages/api`. No wiring, no fake endpoints.

**Date:** 2026-09-08 (PT)

**Sources**
- Working UI tree: `/Users/zscaler/Downloads/billion-digest`
- Real API (read-only): `/Users/zscaler/Downloads/billion/packages/api`
- Branch: local `ui-port` only (no push / no PR)

**Counts:** mapped **22** · gaps **9**

**Tabs (digest):** Feed (`index` → `DigestHome`) · Browse (`feed` → `BrowseCatalog`) · Elections · Feedback · Settings (hidden in production; profile mark)

**Router namespaces:** `auth` · `civic` · `content` · `feedback` · `legistar` · `openStates` · `places` · `post` · `user` · `video`

---

## Digest (Feed / cover / article)

Feed tab renders `DigestHome` on **real tRPC** (`content.getFeaturedBills`, fallback `content.getByType`). `BrowseCatalog` lives on the Browse tab. Article detail already calls `content.getById`. Section titles (“THE DAILY BRIEF” / “Today’s local news”) are client chrome — there is still no `digest.getToday`.

| Screen | Field / data | Procedure | Input | Notes |
| --- | --- | --- | --- | --- |
| `DigestHome` | Local rail cards | `content.getFeaturedBills` then `content.getByType` `{ type: "bill", limit, jurisdiction }` | `{ jurisdiction }` from saved address → Browse state → `"ca"` | Card fields ↔ `title`, `description`, `billNumber`, `sourceLabel` / `jurisdiction`, `imageUri`/`thumbnailUrl`. No Prop 12 / SB 410 fixtures. |
| `DigestHome` | “Also today” federal cover | `content.getFeaturedBills` `{ jurisdiction: "federal" }` then `content.getByType` `{ type: "bill", limit: 3, jurisdiction: "federal" }` | same | First featured (or feed) item. Bundled capitol PNG is fallback art only when `imageUri`/`thumbnailUrl` is missing. |
| `DigestHome` | Section chrome “THE DAILY BRIEF” / “Today’s local news” | **GAP** — no `digest.*` ranking procedure | — | Chrome only. Do not invent a daily digest endpoint or a “N bills moved” / read-time field. |
| `DigestGreetingBar` | Location line | Client `useUserAddress` (Places address stored on Elections) | — | Hardcoded East Bay city menu **removed**. Still **GAP**: no city-list / district procedure. Never invent districts. |
| `DigestGreetingBar` | Time-of-day greeting (`Good Morning`…) | Client-only (local clock + AsyncStorage) | — | No backend. |
| `article-detail` | Article body / title / sponsor / lenses / brief | `content.getById` | `{ id: string }` | Already wired. Key outs: `title`, `description`, `billNumber`, `articleContent`, `originalContent`, `url`, `actions`, `status`, `sponsor`, `lensData`, `brief`, `imageUri`. |
| `bill-sponsor-profile` | Sponsor identity + sponsored bills | `content.getSponsorProfile` | `{ billId: uuid }` | Already wired. |

---

## Browse (bills / executive / courts)

`apps/expo/src/app/(tabs)/feed.tsx` → `BrowseCatalog` in `index.tsx`. Largely already on real tRPC; listed so Digest port can reuse the same procedures.

| Screen | Hardcoded field / data | Procedure | Input | Notes |
| --- | --- | --- | --- | --- |
| Browse filters | Pills All / Bills / Executive / Courts / Briefings | `content.getByType` | `{ type: "all"\|"bill"\|"government_content"\|"court_case"\|"general", limit?, cursor?, jurisdiction }` | `jurisdiction`: `federal` \| `ca` \| `mo` \| `nc` \| `tx`. Exec/courts only populate for `federal`. |
| Browse search | Search box (≥2 chars) | `content.search` | `{ query, type?, limit?, jurisdiction }` | Also used for “other jurisdiction” teaser (`limit: 3`). |
| Featured strip | Featured bill cards | `content.getFeaturedBills` | `{ jurisdiction }` | Score + editorial overrides. Out: bill card + featured metadata. |
| Content cards | title / description / type / billNumber / image | same list/search outs | — | Shape includes `id`, `title`, `description`, `type`, `billNumber?`, `billStatus?`, `chamber?`, `sponsor?`, `imageUri?`, `activityAt?`. |
| Election banner on Browse | Upcoming election chip | `civic.getVoterInfo` | `{ address, electionId? }` | Enabled when `useUserAddress` has address (disabled in `__DEV__` on Browse). |
| Saved toggle | Bookmark | `content.saved.add` / `content.saved.remove` / `content.saved.list` | protected; content id + type | Via `useSavedContent`. |
| Jurisdiction row | Federal vs CA (etc.) picker | Client `JURISDICTIONS` → passed into content procs | — | Not Places; content-scope only. |

---

## Ballot / local / address

Elections tab + local-decision stack. **Verified wired to real tRPC** (2026-09-11 PT) — no fake ballot contests / dummy local-decision lists remain on production screens. Address entry and ballot hit live procs; **council-district-from-address is still a GAP (never invent)**.

| Screen | Hardcoded field / data | Procedure | Input | Notes |
| --- | --- | --- | --- | --- |
| Elections address field | Autocomplete suggestions | `places.autocomplete` | `{ query, sessionToken? }` | US address predictions; empty if query &lt; 3 chars. Used by `AddressAutocomplete` on Elections tab **and** `MyBallotSection` on local-elections. |
| Elections address commit | Resolve place → formatted address | `places.details` (mutation) | `{ placeId, sessionToken? }` | Then stored in AsyncStorage via `useUserAddress` (not a user.* address API). |
| Empty ballot teaser (no address) | Next CA election name + `electionDay` | `civic.getElections` | none | Client filters Civic's nationwide list: skip test id `2000`, keep `/state:ca` or `country:us`, upcoming only. **Do not** invent a “typical CA timeline”. |
| Ballot / contests / measures | Candidate contests + referendum fields | `civic.getVoterInfo` | `{ address, electionId? }` | Source of `election`, `contests[]`, `normalizedInput`, `pollingLocations`, `earlyVoteSites`, `mailOnly`. CA-only product gate in UI (`isCaliforniaState` accepts `CA` or `California`). |
| Election hero | Election name / day | `civic.getVoterInfo` → `election` | same | Extra calendar rows: CA 15-day register offset from `electionDay` (Civic has no deadline field); early-vote date from `earlyVoteSites[].startDate` when present, else CA mail offset. |
| Live results (statewide) | Governor / SoS etc. | `civic.getElectionResults` | `{ offices? }` optional | CA SOS feed; section self-hides when stale. |
| Live results (voter districts) | House / State Senate / Assembly | `civic.getDistrictResults` | `{ refs: { chamber, number }[] }` max 10 | Refs derived from ballot contests — **not** a free-form address→district API. |
| Your Elected Officials | Rep cards | `civic.getElectedOfficials` | `{ address }` (min 5) | Internally uses Civic `divisionsByAddress` + Open States people — **not exposed** as its own district-lookup procedure. Out: `officials[]` (`name`, `office`, `party`, `district?`, `image`, contact). |
| Polling row / Where to vote | Assigned locations | `civic.getVoterInfo` → `pollingLocations` / `earlyVoteSites` / `dropOffLocations` / `mailOnly` | same | Subtitle is Civic location name+city, never a hardcoded `vote.gov`. |
| Logistics calendar | Election Day (+ optional early vote) | Address: `getVoterInfo.election`; no address: CA-filtered `getElections` | same | **Do not** pick the soonest nationwide `getElections` row — that can be another state. |
| Local decisions preview / list | Upcoming/recent agendas | `legistar.listDecisions` | `{ jurisdiction, timeline?, from?, to?, topic?, district?, query?, limit?, offset?/cursor? }` | UI hardcodes `jurisdiction: "sanjose"` after client string-match `detectJurisdictionKey(address)`. Optional `district: 1–10` exists on API but UI never supplies it. |
| Local decision detail | Full matter + votes + docs | `legistar.getDecision` | `{ id }` | |
| Ingestion staleness note | Header health | `legistar.getIngestionHealth` | `{ jurisdiction }` | |
| `contest-detail` / `measure-detail` | Candidate / measure copy | Params from `getVoterInfo` contests (no separate fetch) | route params | Soft gap: no refresh-by-id for a single contest/measure. Enrichment lives inside Civic voter-info path. |
| Address → **city council district #** for Legistar filter | Would power `listDecisions({ district })` personalization | **GAP** | — | See Gaps. Do **not** invent. |
| Digest / Elections city labels for non-SJ (Sunnyvale, Santa Clara keys exist client-side) | UI still forces San José for Legistar | Partial: keys in `LOCAL_JURISDICTIONS`; ingestion “first release” is SJ | — | Flag as product/data gap, not a new fake endpoint. |

---

## Gaps / no endpoint

**Count: 9** (explicit)

1. **Address → city council / Legistar district number** — **GAP (still open; do not invent).** `legistar.listDecisions` accepts optional `district: 1–10`, but nothing in `packages/api` exposes “address → council district”. UI never supplies `district` (verified). `civic.getElectedOfficials` uses `divisionsByAddress` internally for **state/federal** legislative districts only and does not return San José council districts. **Never invent a district or endpoint.**
2. **Digest location menu cities** (Pleasanton / Livermore / Dublin / San Ramon / Federal) — **GAP.** No city-list or city-as-jurisdiction procedure. Real path is Places address + stored `user_address`. Hardcoded East Bay picker **removed**; greeting reads `useUserAddress` only.
3. **Dedicated daily digest / cover / “THE DAILY BRIEF” feed** — **GAP.** No `digest.getToday` (or similar). Closest: `content.getFeaturedBills` + `content.getByType`. Feed chrome uses those; it does not invent ranking, moved-counts, or read-time.
4. **DigestGreetingBar location ↔ real address** — **wired to `useUserAddress`.** Still no city-list / district procedure (`places.*` stay on Elections).
5. **Client-only jurisdiction detection** (`detectJurisdictionKey` regex on formatted address) — not a server geocoder; unknown cities → null / hide local UI. No `places.resolveJurisdiction` procedure.
6. **Non–San José local Legistar UIs** — client knows `sunnyvale` / `santaclara` keys; screens still pin `sanjose`. Data/product gap vs missing router.
7. **Contest / measure detail refresh-by-id** — ballot detail screens are param-driven from `getVoterInfo`; no `civic.getContest({ id })`.
8. **Editorial digest cover art** — Digest uses bundled PNGs (`cover-drought.png`, `capitol-line.png`). Content has `imageUri`/`thumbnailUrl` for bills/items, but no separate “cover illustration” CMS endpoint.
9. **ContentBrief stale / mismatched vs Bill title+dek** — **GAP (pipeline; do not invent).** `content.getById` correctly joins `ContentBrief` by `contentId` (verified). For CA SB 492 Wildfire (`fa107d14-8165-482c-acc4-d1938af4c215`) the stored brief is wrong pipeline data: title-echo template ("this 'Wildfire' bill…") + youth-housing / $1B Nov 2026 ballot body. No client-facing regen / repair endpoint. **Mitigation:** article-detail TRUST hide — require substantive overlap with **description** topical tokens (title tokens excluded so title-echo cannot keep a wrong brief); hide → plain explainer. digest-wire / scraper owns fixing `ContentBrief` rows.

### Related (mapped, not inventing)

- Federal/state legislative districts for **reps** → already inside `civic.getElectedOfficials` (do not duplicate as a fake `getDistrict`).
- CA SOS district **results** → `civic.getDistrictResults` needs caller-supplied `{ chamber, number }` from ballot contests.

---

## Procedure cheat-sheet (namespaces found)

| Namespace | Procedures (real) |
| --- | --- |
| `content` | `getAll`, `getFeaturedBills`, `getByType`, `search`, `getById`, `byIds`, `getSponsorProfile`, `saved.list`, `saved.add`, `saved.remove` |
| `civic` | `getElections`, `getElectionResults`, `getDistrictResults`, `getVoterInfo`, `getElectedOfficials` |
| `places` | `autocomplete`, `details` |
| `legistar` | `listDecisions`, `getDecision`, `listBodies`, `getIngestionHealth`, plus legacy `getLocalBills` / `getMeetings` / `getAgenda` / `getVotes` / `getBodies` / `getMeetingVotes` |
| `openStates` | `searchBills`, `getBillDetails`, `getLegislators`, `getBillVotes` |
| `user` | `getPreferences`, `setPreferences`, `getBlocked`, `addBlocked`, `removeBlocked`, `getSettings`, `updateSettings`, `updateProfile` |
| `auth` | `getSession`, `getSecretMessage` |
| `feedback` | `submit` |
| `post` | `create`, `delete` (legacy template) |
| `video` | `getInfinite` (empty compatibility feed) |

---

## Prove-it notes

- Read `AGENTS.md` (digest + billion): Expo data path is tRPC only; start from `packages/api/src/root.ts` + `docs/api.md`.
- Digest Feed (`DigestHome`) is on `content.getFeaturedBills` + `content.getByType`. Greeting location is `useUserAddress`. Bundled PNGs are art fallbacks, not content fixtures.
- **Ballot / local / address (verified 2026-09-11 PT):** Elections tab, AddressAutocomplete, ElectionResultsSection, RepsSection, LocalDecisionsPreview, local-decisions, local-decision-detail, local-elections, contest-detail, measure-detail all call real `places.*` / `civic.*` / `legistar.*` procs — no fixture ballot arrays. Empty-state teaser uses CA-filtered `civic.getElections` (`name` + `electionDay` only). Polling subtitle uses `getVoterInfo.pollingLocations`. Logistics calendar prefers address-resolved `getVoterInfo.election` over nationwide `getElections`. Contest/measure detail remain param-driven from `getVoterInfo` (Gap #7). `listDecisions` / preview still pin `jurisdiction: "sanjose"` and **do not** pass `district` (Gaps #1, #5, #6). CA 15-day register offset is a client heuristic from `electionDay` — Civic has no registration-deadline field.
- Browse was already on real tRPC. Digest Feed uses the same `content.*` procs; remaining gaps are ranking (`digest.getToday`), council-district lookup, and ContentBrief pipeline rows.
- **ContentBrief mismatch (verified 2026-09-08 PT):** Not a wrong `getById` join. Wrong row *content* for bill id `fa107d14…` (Wildfire). Client trust-hide in `article-detail.tsx` ignores title-echo hits; no regen endpoint invented. Branch `ui-port` only; no push / no PR.
- Wiring edit this pass: `MyBallotSection` freeform TextInput → `AddressAutocomplete` (`places.autocomplete` / `places.details`). No address→council-district invention. Branch `ui-port` only; no push / no PR.
